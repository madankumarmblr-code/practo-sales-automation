import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { discoverClinics, getDiscoveryMeta } from '../services/clinicDiscovery.js';
import { leadDedupeKeys, normalizeName, normalizePhone, isAuthenticLead } from '../services/liveDiscovery.js';
import {
  buildOutreachDraft,
  suggestFollowUp,
  suggestReplies,
  qualifyLeadPatch,
  pickSmartChannel,
} from '../services/aiAssist.js';

const now = () => new Date().toISOString();

export function registerLeadRoutes(app) {
  app.get('/api/lead-generator/meta', (_req, res) => {
    res.json(getDiscoveryMeta());
  });

  app.get('/api/leads', (req, res) => {
    const { stage, status, source, q, assigned_to, temperature } = req.query;
    let rows = db.prepare('SELECT * FROM leads ORDER BY score DESC, updated_at DESC').all();
    if (stage) rows = rows.filter((l) => l.stage === stage);
    if (status) rows = rows.filter((l) => l.status === status);
    if (source) rows = rows.filter((l) => l.source === source);
    if (temperature) rows = rows.filter((l) => l.temperature === temperature);
    if (assigned_to) rows = rows.filter((l) => l.assigned_to === assigned_to);
    if (q) {
      const needle = q.toString().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(needle) ||
          (l.company || '').toLowerCase().includes(needle) ||
          (l.email || '').toLowerCase().includes(needle)
      );
    }
    res.json(rows);
  });

  app.post('/api/leads/bulk-qualify', (req, res) => {
    const { leadIds = [], temperature } = req.body || {};
    if (!Array.isArray(leadIds) || !leadIds.length) {
      return res.status(400).json({ error: 'leadIds required' });
    }
    let patch;
    try {
      patch = qualifyLeadPatch(temperature);
    } catch (err) {
      return res.status(err.status || 400).json({ error: err.message });
    }
    const ts = now();
    const upd = db.prepare(`
      UPDATE leads
      SET temperature=?, score=?, stage=?, status=?, next_action=?, updated_at=?
      WHERE id=?
    `);
    const updated = [];
    const tx = db.transaction((ids) => {
      for (const id of ids) {
        const existing = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
        if (!existing) continue;
        upd.run(patch.temperature, patch.score, patch.stage, patch.status, patch.next_action, ts, id);
        updated.push(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
      }
    });
    tx(leadIds);
    res.json({ ok: true, temperature: patch.temperature, updated: updated.length, leads: updated });
  });

  app.post('/api/ai/draft', (req, res) => {
    const body = req.body || {};
    const lead =
      body.lead ||
      (body.leadId ? db.prepare('SELECT * FROM leads WHERE id = ?').get(body.leadId) : null);
    if (!lead) return res.status(400).json({ error: 'lead or leadId required' });
    res.json(buildOutreachDraft(lead, { channel: body.channel, product: body.product || 'prime' }));
  });

  app.post('/api/ai/follow-up', (req, res) => {
    const body = req.body || {};
    let lead = body.lead || null;
    let activities = body.activities || [];
    if (body.leadId) {
      lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(body.leadId);
      activities = db
        .prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC')
        .all(body.leadId);
    }
    if (!lead) return res.status(400).json({ error: 'lead or leadId required' });
    res.json(suggestFollowUp(lead, activities));
  });

  app.post('/api/ai/replies', (req, res) => {
    const body = req.body || {};
    const lead =
      body.lead ||
      (body.leadId ? db.prepare('SELECT * FROM leads WHERE id = ?').get(body.leadId) : null);
    if (!lead) return res.status(400).json({ error: 'lead or leadId required' });
    res.json(
      suggestReplies(lead, {
        channel: body.channel,
        inbound: body.inbound || '',
        product: body.product || 'prime',
      })
    );
  });

  app.post('/api/ai/channel', (req, res) => {
    const lead = req.body?.lead || null;
    if (!lead) return res.status(400).json({ error: 'lead required' });
    res.json(pickSmartChannel(lead));
  });

  app.get('/api/leads/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Lead not found' });
    const activities = db
      .prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    res.json({
      ...row,
      activities,
      followUp: suggestFollowUp(row, activities),
      smartChannel: pickSmartChannel(row),
    });
  });

  app.post('/api/leads', (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'Name is required' });
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO leads (
        id, name, email, phone, company, title, source, stage, score, value,
        status, assigned_to, last_contacted_at, next_action, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name,
      body.email || '',
      body.phone || '',
      body.company || '',
      body.title || '',
      body.source || 'manual',
      body.stage || 'new',
      body.score ?? 40,
      body.value ?? 0,
      body.status || 'open',
      body.assigned_to || 'Unassigned',
      body.last_contacted_at || null,
      body.next_action || '',
      body.notes || '',
      ts,
      ts
    );
    res.status(201).json(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
  });

  app.put('/api/leads/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });
    const b = req.body || {};
    const next = {
      name: b.name ?? existing.name,
      email: b.email ?? existing.email,
      phone: b.phone ?? existing.phone,
      company: b.company ?? existing.company,
      title: b.title ?? existing.title,
      source: b.source ?? existing.source,
      stage: b.stage ?? existing.stage,
      score: b.score ?? existing.score,
      value: b.value ?? existing.value,
      status: b.status ?? existing.status,
      assigned_to: b.assigned_to ?? existing.assigned_to,
      last_contacted_at: b.last_contacted_at ?? existing.last_contacted_at,
      next_action: b.next_action ?? existing.next_action,
      notes: b.notes ?? existing.notes,
      temperature: b.temperature ?? existing.temperature ?? '',
      preferred_channel: b.preferred_channel ?? existing.preferred_channel ?? '',
    };
    db.prepare(`
      UPDATE leads SET
        name=?, email=?, phone=?, company=?, title=?, source=?, stage=?, score=?, value=?,
        status=?, assigned_to=?, last_contacted_at=?, next_action=?, notes=?, updated_at=?,
        temperature=?, preferred_channel=?
      WHERE id=?
    `).run(
      next.name,
      next.email,
      next.phone,
      next.company,
      next.title,
      next.source,
      next.stage,
      next.score,
      next.value,
      next.status,
      next.assigned_to,
      next.last_contacted_at,
      next.next_action,
      next.notes,
      now(),
      next.temperature,
      next.preferred_channel,
      req.params.id
    );

    if (b.stage && b.stage !== existing.stage) {
      db.prepare(`
        INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
        VALUES (?, ?, NULL, 'stage', 'system', ?, ?, 'completed', ?)
      `).run(
        nanoid(),
        req.params.id,
        `Moved to ${b.stage}`,
        `Stage changed from ${existing.stage} to ${b.stage}`,
        now()
      );
    }

    res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/leads/:id', (req, res) => {
    db.prepare('DELETE FROM activities WHERE lead_id = ?').run(req.params.id);
    const info = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Lead not found' });
    res.json({ ok: true });
  });

  // Lead generator — sheet + locality expansion + live multi-source discovery
  app.post('/api/lead-generator/search', async (req, res) => {
    const body = req.body || {};
    const city = body.city || body.location;
    const {
      zone = 'All',
      zones,
      localities,
      specialty,
      keyword,
      keywords,
      limit = null,
      live = true,
      allowSynthetic = false,
      maxLocalities = 40,
    } = body;
    const kw = keyword || specialty || (Array.isArray(keywords) ? keywords[0] : null);

    if (!city || !kw) {
      return res.status(400).json({
        error: 'Select city and keyword/specialty (zone can be All; localities auto-expand under zone)',
      });
    }

    try {
      const discovery = await discoverClinics({
        city,
        zone,
        zones,
        localities,
        specialty: kw,
        keyword: kw,
        keywords,
        limit,
        live,
        allowSynthetic: allowSynthetic === true || allowSynthetic === '1',
        maxLocalities,
      });
      if (discovery.error && !discovery.results?.length) {
        return res.status(400).json({ error: discovery.error });
      }
      res.json(discovery);
    } catch (err) {
      res.status(500).json({ error: err.message || 'Discovery failed' });
    }
  });

  app.get('/api/lead-generator/options', (req, res) => {
    const city = (req.query.city || '').toString();
    const zone = (req.query.zone || '').toString();
    const keyword = (req.query.keyword || req.query.specialty || '').toString();
    const meta = getDiscoveryMeta();
    const zones = city ? meta.zonesByCity[city] || [] : [];
    const zoneMeta = city ? meta.zoneMetaByCity[city] || {} : {};
    let keywords = meta.keywords || meta.specialties || [];
    if (city && zone && zone !== 'All') {
      keywords = meta.keywordsByCityZone[`${city}||${zone}`] || [];
    } else if (city) {
      keywords = meta.keywordsByCity[city] || keywords;
    }
    let filteredZones = zones;
    if (city && keyword) {
      filteredZones = zones.filter((z) =>
        (meta.keywordsByCityZone[`${city}||${z}`] || []).includes(keyword)
      );
      if (!filteredZones.length) filteredZones = zones;
    }
    res.json({
      city,
      zone,
      keyword,
      zones: filteredZones,
      zoneMeta,
      keywords,
      cities: meta.cities,
    });
  });

  app.post('/api/lead-generator/import', (req, res) => {
    const { leads: incoming = [] } = req.body || {};
    if (!Array.isArray(incoming) || !incoming.length) {
      return res.status(400).json({ error: 'leads array required' });
    }
    const insert = db.prepare(`
      INSERT INTO leads (
        id, name, email, phone, company, title, source, stage, score, value,
        status, assigned_to, last_contacted_at, next_action, notes, created_at, updated_at,
        temperature, preferred_channel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'Unassigned', NULL, ?, ?, ?, ?, ?, ?)
    `);
    const findByPhone = db.prepare(
      `SELECT id FROM leads WHERE replace(replace(replace(replace(phone,' ',''),'+',''),'-',''),'(','') LIKE ? LIMIT 1`
    );
    const findByEmail = db.prepare(`SELECT id FROM leads WHERE lower(email) = lower(?) LIMIT 1`);
    const findByCompanyCity = db.prepare(
      `SELECT id, company, notes FROM leads WHERE lower(company) = lower(?) LIMIT 20`
    );
    const findByPlaceId = db.prepare(
      `SELECT id FROM leads WHERE notes LIKE ? LIMIT 1`
    );
    const created = [];
    const skipped = [];
    const ts = now();
    const tx = db.transaction((items) => {
      const seen = new Set();
      for (const item of items) {
        if (!isAuthenticLead(item) && item.discoverySource === 'sheet_locality') {
          skipped.push({
            reason: 'synthetic_rejected',
            company: item.clinicName || item.company || '',
          });
          continue;
        }
        if (
          /sheet_locality|zone locality expansion|sheet \+ locality/i.test(
            `${item.discoverySource || ''} ${item.source || ''} ${item.matchReason || ''}`
          )
        ) {
          skipped.push({
            reason: 'synthetic_rejected',
            company: item.clinicName || item.company || '',
          });
          continue;
        }
        const owner = item.owner || {};
        const phone = normalizePhone(owner.phone || item.phone || '');
        const email = String(owner.email || item.email || '').trim().toLowerCase();
        const company = String(item.clinicName || item.company || '').trim();
        // Contact name is NOT NULL in DB — fall back to clinic when owner is unknown
        const contactName = String(
          owner.name || item.name || company || 'Clinic contact'
        ).trim();
        const city = String(item.city || '').trim();
        const placeId = item.placeId || null;
        const batchKeys = leadDedupeKeys({
          ...item,
          phone,
          email,
          clinicName: company,
          owner: { ...owner, phone, email },
        });
        if (batchKeys.some((k) => seen.has(k))) {
          skipped.push({ reason: 'duplicate_in_batch', company });
          continue;
        }
        for (const k of batchKeys) seen.add(k);

        if (placeId && findByPlaceId.get(`%Place ID: ${placeId}%`)) {
          skipped.push({ reason: 'duplicate_place', company, placeId });
          continue;
        }
        if (phone && findByPhone.get(`%${phone}`)) {
          skipped.push({ reason: 'duplicate_phone', company, phone });
          continue;
        }
        if (email && findByEmail.get(email)) {
          skipped.push({ reason: 'duplicate_email', company, email });
          continue;
        }
        if (company && city) {
          const companyHits = findByCompanyCity.all(company);
          const cityLower = city.toLowerCase();
          const locality = String(item.locality || item.zone || '')
            .trim()
            .toLowerCase();
          const dupCompany = companyHits.find((row) => {
            const notes = String(row.notes || '').toLowerCase();
            if (!notes.includes(cityLower)) return false;
            if (locality && notes.includes(locality)) return true;
            // Same company + city without locality still counts as duplicate
            return normalizeName(row.company) === normalizeName(company);
          });
          if (dupCompany) {
            skipped.push({ reason: 'duplicate_company', company });
            continue;
          }
        }

        const id = nanoid();
        const marketing = item.marketingHead || null;
        const practo = item.practo || {};
        const platforms = item.platformNames || item.platforms?.map((p) => p.name) || [];
        const channelPick = pickSmartChannel({
          phone: owner.phone || item.phone,
          email: owner.email || item.email,
          score: item.score,
          website: item.website,
          practo,
          notes: practo.hasProfile ? 'Practo profile: Yes' : 'Practo profile: No',
        });
        const notes = [
          item.matchReason || 'Imported from multi-platform lead generator',
          `Clinic: ${company}`,
          `Specialty: ${item.specialty || item.keyword || ''}`,
          `Location: ${item.locality || item.zone || ''}, ${city || item.location || ''}`,
          `Zone: ${item.zone || ''}`,
          `Address: ${item.address || ''}`,
          `Website: ${item.website || ''}`,
          item.placeId ? `Place ID: ${item.placeId}` : null,
          item.openingHours?.length ? `Hours: ${item.openingHours.join(' | ')}` : null,
          `Owner: ${owner.name || item.name || ''} | ${owner.phone || item.phone || ''} | ${owner.email || item.email || ''}`,
          marketing
            ? `Marketing Head: ${marketing.name} | ${marketing.phone || ''} | ${marketing.email || ''}`
            : 'Marketing Head: Not listed',
          `Practo profile: ${practo.hasProfile ? 'Yes' : 'No'}${practo.url ? ` (${practo.url})` : ''}`,
          `Platforms: ${platforms.join(', ') || 'n/a'}`,
          `Discovery source: ${item.discoverySource || item.source || 'n/a'}`,
          `Smart channel: ${channelPick.channel} (${channelPick.reasons[0] || ''})`,
        ]
          .filter(Boolean)
          .join('\n');

        insert.run(
          id,
          contactName,
          owner.email || item.email || '',
          owner.phone || item.phone || '',
          company || contactName,
          owner.title || item.title || 'Clinic Owner',
          item.source || 'Multi-platform Discovery',
          item.temperature === 'hot' ? 'qualified' : 'new',
          item.score ?? 50,
          item.estimatedValue ?? item.value ?? 0,
          `Engage via ${item.suggestedChannel || channelPick.channel}`,
          notes,
          ts,
          ts,
          item.temperature || '',
          item.suggestedChannel || channelPick.channel
        );
        created.push(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
      }
    });
    tx(incoming);
    res.status(201).json({
      imported: created.length,
      skipped: skipped.length,
      skipReasons: skipped,
      leads: created,
    });
  });
}
