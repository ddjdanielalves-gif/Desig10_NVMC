const ELDERS = [
    'Daniel Alves da Silva',
    'Edivaldo Conceição Nascimento',
    'Elias Conceição Borges',
    'José Milton Miranda Batista',
    'Leandro Nascimento da Silva',
    'Leonardo da Silva Novaes dos Santos',
    'Paulo Sérgio Coppque de Freitas',
    'Rafael Santos do Espírito Santo',
    'Reginaldo Nascimento Sousa'
];

const SERVOS = [
    'Alan dos Santos Miranda Batista',
    'Alexandre Santos do Nascimento',
    'Gutemberg Moura Dos Santos',
    'Mateus Silva Dos Santos'
];

const READERS = [
    'Alexandre Nascimento',
    'Mateus dos Santos',
    'Alan Miranda',
    'Cléber Bessa',
    'Edvando Silva',
    'Juraci Rebouças',
    'Pedro Costa',
    'Sérgio Gualberto',
    'Ítalo Dantas'
];

const RARE_JOIAS = [
    'José Milton Miranda Batista',
    'Edivaldo Conceição Nascimento'
];

const NOT_PRESIDENTS = new Set([
    'Edivaldo Conceição Nascimento',
    'José Milton Miranda Batista'
]);

const NOT_EBC = new Set([
    'Edivaldo Conceição Nascimento',
    'José Milton Miranda Batista'
]);

// Gutemberg NÃO pode fazer Joias espirituais nem partes de consideração / NVC
const NO_JOIAS = new Set([
    'Gutemberg Moura Dos Santos'
]);

const NO_CONSIDERATION = new Set([
    'Gutemberg Moura Dos Santos'
]);

function maxMonthTarget(name) {
    // Daniel Alves da Silva só deve ter até duas designações no mês
    if (name === 'Daniel Alves da Silva') return 2;
    return 3;
}

const ROLE_AUTO_DEFS = [
    ['presidencia', 'president'],
    ['oracaoFinal', 'both'],
    ['discurso1', 'discurso1', true],
    ['joias', 'joias'],
    ['dirigenteEbc', 'dirigente'],
    ['leitorEbc', 'reader']
];

const savedPeople = JSON.parse(localStorage.getItem('people') || 'null');
const people = savedPeople || {
    elders: [...ELDERS],
    servos: [...SERVOS],
    inactive: []
};

// Sempre garantir que todos os irmãos padrão estejam na lista caso venha do cache
ELDERS.forEach(n => { if (!people.elders.includes(n)) people.elders.push(n); });
SERVOS.forEach(n => { if (!people.servos.includes(n)) people.servos.push(n); });

let state = {
    weeks: [],
    specials: JSON.parse(localStorage.getItem('specials') || '[]'),
    unavs: JSON.parse(localStorage.getItem('unavs') || '[]'),
    history: {},
    roleHistory: {},
    fileHex: '',
    filename: ''
};

const $ = id => document.getElementById(id);

const save = () => {
    localStorage.setItem('people', JSON.stringify(people));
    localStorage.setItem('specials', JSON.stringify(state.specials));
    localStorage.setItem('unavs', JSON.stringify(state.unavs));
};

const all = () => people.elders.concat(people.servos);

const active = () => all().filter(n => !people.inactive.includes(n));

function type(n) {
    return people.elders.includes(n) ? 'elder' : 'servo';
}

function month(w) {
    return (w.dateStart || '').slice(0, 7);
}

function weekIndex(w) {
    return state.weeks.findIndex(x => x.id === w.id);
}

function unavailableWeeksFor(name, w) {
    const result = [];
    const wi = weekIndex(w);
    if (wi < 0) return result;
    state.unavs.forEach(u => {
        if (u.name !== name) return;
        if (u.scope === 'month') {
            if (u.month === month(w) || !u.month) result.push(wi);
            return;
        }
        const duration = Number(u.scope) || Number(u.duration) || 1;
        const start = state.weeks.findIndex(x => x.id === u.weekId);
        if (start >= 0 && wi >= start && wi < start + duration) {
            result.push(wi);
        }
    });
    return result;
}

function count(w, n) {
    return (state.history[month(w)]?.[n] || 0);
}

function rebuildHistory() {
    const h = {};
    const rh = {};
    for (const w of state.weeks) {
        if (w.skipped) continue;
        const m = month(w);
        if (!m) continue;
        h[m] ??= {};
        rh[m] ??= {};

        const names = [
            ...(w.existingAssignedNames || []),
            ...Object.values(w.roles || {}).map(e => (typeof e === 'object' ? e?.name : e)).filter(Boolean),
            ...(w.considerations || []),
            ...(w.nvcAssignments || []).map(a => a.value).filter(Boolean)
        ].filter(Boolean);

        const unique = [...new Set(names)];
        for (const n of unique) {
            if (all().includes(n)) {
                h[m][n] = (h[m][n] || 0) + 1;
            }
        }

        const bump = (n, k) => {
            if (!n || !all().includes(n)) return;
            rh[m][n] ??= {};
            rh[m][n][k] = (rh[m][n][k] || 0) + 1;
        };

        Object.entries(w.roles || {}).forEach(([k, v]) => bump(typeof v === 'object' ? v?.name : v, k));
        (w.considerations || []).forEach(v => bump(v, 'consideracao'));
        (w.nvcAssignments || []).forEach(a => bump(a.value, 'nvc:' + (a.part || 'geral')));
    }
    state.history = h;
    state.roleHistory = rh;
}

function roleCount(w, n, k) {
    if (!k || !n) return 0;
    const m = month(w);
    const rh = state.roleHistory?.[m]?.[n] || {};
    if (k === 'joias') return rh['joias'] || 0;
    if (k === 'discurso1') return rh['discurso1'] || 0;
    if (k === 'presidencia') return rh['presidencia'] || 0;
    if (k === 'dirigenteEbc') return rh['dirigenteEbc'] || 0;
    if (k === 'leitorEbc') return rh['leitorEbc'] || 0;
    if (k === 'oracaoFinal') return rh['oracaoFinal'] || 0;
    if (k.startsWith('nvc:') || k === 'nvc' || k === 'necessidadesLocais' || k === 'consideracao') {
        let nvcTotal = 0;
        for (const [rk, c] of Object.entries(rh)) {
            if (rk.startsWith('nvc:') || rk === 'necessidadesLocais' || rk === 'consideracao') nvcTotal += c;
        }
        return nvcTotal;
    }
    return rh[k] || 0;
}

function isRedundant(w, k, n) {
    if (!n) return false;
    // Mais de 1 vez na mesma semana
    const inWeek = used(w).filter(x => x === n).length;
    if (inWeek > 1) return true;
    // Mais de 1 vez a mesma parte no mês (regra: partes diferentes)
    if (k && roleCount(w, n, k) > 1) return true;
    // Ultrapassou o limite mensal (Daniel max 2, outros max 3, NUNCA 4)
    if (count(w, n) > maxMonthTarget(n)) return true;
    // Indisponível
    if (unavailable(n, w)) return true;
    return false;
}

function unavailable(n, w) {
    return unavailableWeeksFor(n, w).length > 0;
}

function used(w, except) {
    let x = [...(w.existingAssignedNames || [])];
    Object.entries(w.roles || {}).forEach(([k, v]) => {
        const name = typeof v === 'object' ? v?.name : v;
        if (k !== except && k !== 'oracaoInicial' && name) {
            x.push(name);
        }
    });
    (w.considerations || []).forEach(v => { if (v) x.push(v); });
    (w.nvcAssignments || []).forEach(a => { if (a.value) x.push(a.value); });
    return [...new Set(x)];
}

function pool(kind) {
    if (kind === 'president') {
        return people.elders.filter(n => !people.inactive.includes(n) && !NOT_PRESIDENTS.has(n));
    }
    if (kind === 'elder') {
        return people.elders.filter(n => !people.inactive.includes(n));
    }
    if (kind === 'both') {
        return active();
    }
    if (kind === 'discurso1') {
        // Anciãos e servos, sem restrições
        return active();
    }
    if (kind === 'servo') {
        return people.servos.filter(n => !people.inactive.includes(n));
    }
    if (kind === 'joias') {
        // Servos (exceto Gutemberg) + raramente José Milton e Edivaldo Nascimento
        const servos = people.servos.filter(n => !people.inactive.includes(n) && !NO_JOIAS.has(n));
        const rareElders = RARE_JOIAS.filter(n => !people.inactive.includes(n));
        return servos.concat(rareElders).concat(people.elders.filter(n => !rareElders.includes(n)));
    }
    if (kind === 'consideracao' || kind === 'nvc') {
        // Anciãos e Servos ministeriais (exceto Gutemberg)
        return active().filter(n => !NO_CONSIDERATION.has(n));
    }
    if (kind === 'dirigente') {
        // Apenas anciãos, exceto José Milton e Edivaldo
        return people.elders.filter(n => !people.inactive.includes(n) && !NOT_EBC.has(n));
    }
    return READERS.filter(n => !people.inactive.includes(n));
}

function pick(w, kind, ratio, roleKey) {
    const alreadyInWeek = used(w, roleKey);

    // Filtro RÍGIDO:
    // 1. Não inativo
    // 2. Não indisponível
    // 3. Não na mesma semana
    // 4. Limite mensal: count < maxMonthTarget(n) (Daniel max 2, outros max 3, NUNCA 4)
    // 5. NUNCA a mesma parte no mês: roleCount === 0 (partes diferentes!)
    let base = pool(kind).filter(n =>
        !people.inactive.includes(n) &&
        !unavailable(n, w) &&
        !alreadyInWeek.includes(n) &&
        count(w, n) < maxMonthTarget(n) &&
        (roleKey ? roleCount(w, n, roleKey) === 0 : true)
    );

    // Fallback de contingência sem violar a regra de partes diferentes nem semana nem Daniel
    if (!base.length && roleKey) {
        base = pool(kind).filter(n =>
            !people.inactive.includes(n) &&
            !unavailable(n, w) &&
            !alreadyInWeek.includes(n) &&
            roleCount(w, n, roleKey) === 0
        );
    }

    if (!base.length) return '';

    // Regra do Discurso 1: 70% anciãos, 30% servos
    if (kind === 'discurso1') {
        const elders = base.filter(n => type(n) === 'elder');
        const servos = base.filter(n => type(n) === 'servo');
        
        const wantElder = Math.random() < 0.70;
        if (wantElder && elders.length > 0) {
            elders.sort((a, b) => count(w, a) - count(w, b));
            const minC = count(w, elders[0]);
            const ties = elders.filter(n => count(w, n) === minC);
            return ties[Math.floor(Math.random() * ties.length)];
        } else if (servos.length > 0) {
            servos.sort((a, b) => count(w, a) - count(w, b));
            const minC = count(w, servos[0]);
            const ties = servos.filter(n => count(w, n) === minC);
            return ties[Math.floor(Math.random() * ties.length)];
        } else if (elders.length > 0) {
            elders.sort((a, b) => count(w, a) - count(w, b));
            const minC = count(w, elders[0]);
            const ties = elders.filter(n => count(w, n) === minC);
            return ties[Math.floor(Math.random() * ties.length)];
        }
    }

    // Joias: preferência absoluta para servos (exceto Gutemberg), raramente José Milton/Edivaldo
    if (kind === 'joias') {
        const servos = base.filter(n => type(n) === 'servo' && !NO_JOIAS.has(n));
        if (servos.length) {
            servos.sort((a, b) => count(w, a) - count(w, b));
            const minC = count(w, servos[0]);
            const ties = servos.filter(n => count(w, n) === minC);
            return ties[Math.floor(Math.random() * ties.length)];
        }
    }

    // Ordenação por contagem mensal para equilibrar 2 a 3 designações por irmão
    base.sort((a, b) => {
        const diff = count(w, a) - count(w, b);
        if (diff !== 0) return diff;
        if (type(a) === 'elder' && type(b) !== 'elder') return -1;
        if (type(a) !== 'elder' && type(b) === 'elder') return 1;
        return 0;
    });

    const min = count(w, base[0]);
    const ties = base.filter(n => count(w, n) === min);
    return ties[Math.floor(Math.random() * ties.length)];
}

function autoWeek(w) {
    if (w.skipped) return;
    w.roles ??= {};
    w.nvcAssignments ??= [];

    for (const [k, p, r] of ROLE_AUTO_DEFS) {
        if (!w.roles[k] || !w.roles[k].name) {
            const n = pick(w, p, r, k);
            if (n) w.roles[k] = { name: n, manual: false };
        }
    }

    w.roles.oracaoInicial = w.roles.presidencia ? { name: w.roles.presidencia.name, manual: false } : { name: '', manual: false };

    const slots = (w.nvcSlots || []).filter(s => s.assignable !== false);
    for (const slot of slots) {
        let assignment = w.nvcAssignments.find(a => a.slotId === slot.slotId || a.rowIndex === slot.rowIndex);
        if (!assignment) {
            assignment = { slotId: slot.slotId, rowIndex: slot.rowIndex, part: slot.part, value: '', manual: false };
            w.nvcAssignments.push(assignment);
        }
        if (!assignment.value) {
            const n = pick(w, 'nvc', false, 'nvc:' + (slot.part || 'geral'));
            if (n) {
                assignment.value = n;
                assignment.manual = false;
            }
        }
    }
}

function conflicts(w) {
    const c = {};
    used(w).forEach(n => {
        if (n) c[n] = (c[n] || 0) + 1;
    });
    return Object.keys(c).filter(n => c[n] > 1);
}

function opts(w, k, current = '') {
    const kind = k === 'presidencia' ? 'president'
                 : k === 'oracaoInicial' || k === 'oracaoFinal' ? 'both'
                 : k === 'discurso1' ? 'discurso1'
                 : k === 'joias' ? 'joias'
                 : k === 'dirigenteEbc' ? 'dirigente'
                 : 'reader';
    // Mostra todos os elegíveis que NÃO estão indisponíveis (exceto o atual, para não sumir)
    const list = pool(kind).filter(n => n === current || !unavailable(n, w));
    return `<option value="">— selecionar —</option>` +
        list.map(n =>
            `<option ${n === current ? 'selected' : ''} value="${esc(n)}">
                ${esc(n)} (${type(n) === 'elder' ? 'ancião' : 'servo'}${
                    n !== current && used(w, k).includes(n) ? ' — já designado nesta semana; será realocado se necessário' : ''
                })
            </option>`
        ).join('');
}

function esc(s) {
    return String(s || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function render() {
    rebuildHistory();
    renderPeople();
    renderConfig();
    $('weeks').innerHTML = state.weeks.map((w, i) => weekHtml(w, i)).join('') || '<div class="card muted">Envie um DOCX para começar.</div>';
    renderBalance();
}

function renderPeople() {
    let html = '';
    for (const [title, key] of [['Anciãos', 'elders'], ['Servos ministeriais', 'servos']]) {
        html += `<h3 class="muted">${title}</h3>`;
        people[key].forEach(n => {
            html += `<div class="item ${people.inactive.includes(n) ? 'inactive' : ''}">
                <span>${esc(n)}</span>
                <button onclick="toggleMember('${esc(n)}')">${people.inactive.includes(n) ? 'Reativar' : 'Retirar'}</button>
            </div>`;
        });
    }
    $('members').innerHTML = html;
}

function renderConfig() {
    $('unavName').innerHTML = active().map(n => `<option>${esc(n)}</option>`).join('');
    $('unavWeek').innerHTML = state.weeks.map(w => `<option value="${w.id}">${esc(w.label)}</option>`).join('');
    $('unavs').innerHTML = state.unavs.map((u, i) => {
        const dur = Number(u.scope) || Number(u.duration) || 1;
        const durText = u.scope === 'month' ? 'Mês inteiro' : (dur === 1 ? '1 semana' : dur + ' semanas');
        const startWeek = state.weeks.find(w => w.id === u.weekId)?.label || (u.scope === 'month' ? 'todo o mês' : 'semana');
        return `<div class="item">
            <span>${esc(u.name)} — ${durText} (${startWeek})</span>
            <button onclick="removeUnav(${i})">✕</button>
        </div>`;
    }).join('') || '<div class="muted">Nenhuma indisponibilidade.</div>';
    $('specials').innerHTML = state.specials.map((s, i) =>
        `<div class="item">
            <span>${s.start} → ${s.end} — ${esc(s.label)}</span>
            <button onclick="removeSpecial(${i})">✕</button>
        </div>`
    ).join('') || '<div class="muted">Nenhuma data especial cadastrada.</div>';
}

function weekHtml(w, i) {
    const c = conflicts(w);
    if (w.skipped) {
        return `<section class="week">
            <div class="week-head"><strong>S${i+1} · ${esc(w.label)}</strong><span>SEM REUNIÃO — ${esc(w.skipReason)}</span></div>
        </section>`;
    }

    const role = (k, l) => {
        const val = w.roles?.[k]?.name || '';
        const cls = c.includes(val) ? 'conflict' : '';
        return `<div class="role">
            <label>${l}</label>
            <select class="${cls}" onchange="setRole(${w.id},'${k}',this.value)">
                ${opts(w, k, val)}
            </select>
        </div>`;
    };

    const nvcAssignments = w.nvcAssignments || [];
    const nvcSlots = (w.nvcSlots || []).filter(s => s.assignable !== false);
    const nvcHtml = nvcSlots.length ? nvcSlots.map(slot => {
        const assignment = nvcAssignments.find(a => a.slotId === slot.slotId || a.rowIndex === slot.rowIndex);
        const value = assignment?.value || slot.current || '';
        const cls = c.includes(value) ? 'conflict' : '';
        return `<div class="role">
            <label>Parte ${esc(slot.part)}${slot.text ? ' — ' + esc(slot.text) : ''}</label>
            <select class="${cls}" onchange="setNvc(${w.id},${slot.rowIndex},this.value)">
                <option value="">— selecionar —</option>
                ${pool('nvc').filter(n => n === value || !unavailable(n, w)).map(n =>
                    `<option value="${esc(n)}" ${n === value ? 'selected' : ''}>
                        ${esc(n)} (${type(n) === 'elder' ? 'ancião' : 'servo'}${n !== value && used(w, 'nvc').includes(n) ? ' — já designado nesta semana; será realocado se necessário' : ''})
                    </option>`
                ).join('')}
            </select>
        </div>`;
    }).join('') : '<div class="muted">Nenhuma parte de Nossa Vida Cristã encontrada.</div>';

    const blocked = (w.existingAssignedNames || []).join(', ');
    const necLocaisVal = typeof w.roles?.necessidadesLocais === 'object' ? w.roles?.necessidadesLocais?.name : (w.roles?.necessidadesLocais || '');

    return `<section class="week">
        <div class="week-head"><strong>S${i+1} · ${esc(w.label)}</strong><span>${w.dateStart}</span></div>
        ${c.length ? `<div class="msg warn">⚠ Conflito detectado: ${c.map(esc).join(', ')} possui mais de 1 designação nesta semana.</div>` : ''}
        ${blocked ? `<div class="msg info">Designados no documento original (bloqueados para novas partes): ${esc(blocked)}</div>` : ''}
        <div class="grid">
            ${role('presidencia','Presidência')}
            <div class="role">
                <label>Oração inicial</label>
                <div class="readonly-role">${esc(w.roles?.presidencia?.name || '—')}<span class="muted"> (= presidência)</span></div>
            </div>
            ${role('oracaoFinal','Oração final')}
            ${role('discurso1','Discurso 1')}
            ${role('joias','Joias espirituais')}
            <div class="role wide">
                <label>Leitura da Bíblia (mantida do original)</label>
                <div class="readonly-box">${esc(w.existing?.leitura || '—')}</div>
            </div>
            <div class="role wide">
                <label>Faça Seu Melhor no Ministério (mantido do original)</label>
                <div class="readonly-box">${esc(w.existing?.facaSeuMelhor || '—')}</div>
            </div>
            <div class="role wide">
                <label>Nossa Vida Cristã — partes designáveis</label>
                <div class="nvc-grid">${nvcHtml}</div>
            </div>
            <div class="role wide">
                <label>Necessidades Locais (selecionar ancião ou digitar)</label>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <select style="flex: 1; min-width: 200px;" onchange="setNecLocaisSelect(${w.id}, this.value)">
                        <option value="">— selecionar ancião —</option>
                        ${people.elders.filter(n => !people.inactive.includes(n) && (n === necLocaisVal || !unavailable(n, w))).map(n =>
                            `<option value="${esc(n)}" ${n === necLocaisVal ? 'selected' : ''}>
                                ${esc(n)} ${n !== necLocaisVal && used(w, 'necessidadesLocais').includes(n) ? ' (já designado na semana)' : ''}
                            </option>`
                        ).join('')}
                    </select>
                    <input style="flex: 1; min-width: 200px;" placeholder="Ou digite o nome / tema..." value="${esc(necLocaisVal)}" onchange="setText(${w.id},'necessidadesLocais',this.value)">
                </div>
            </div>
            ${role('dirigenteEbc','Dirigente do Estudo Bíblico de Congregação')}
            ${role('leitorEbc','Leitor do Estudo Bíblico de Congregação')}
        </div>
        <div class="btnrow">
            <button onclick="autoOne(${w.id})">Preencher semana</button>
            <button onclick="clearOne(${w.id})">Limpar novas designações</button>
        </div>
    </section>`;
}

const ROLE_LABELS = {
    presidencia: 'Presidência',
    oracaoFinal: 'Oração final',
    discurso1: 'Discurso 1',
    joias: 'Joias espirituais',
    dirigenteEbc: 'Dirigente EBC',
    leitorEbc: 'Leitor EBC',
    necessidadesLocais: 'Necessidades Locais'
};

function buildRoleBreakdown(m) {
    const b = {};
    const add = (name, label) => {
        if (!name) return;
        b[name] ??= {};
        b[name][label] = (b[name][label] || 0) + 1;
    };
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (month(w) !== m) continue;
        const trackedThisWeek = new Set();
        Object.entries(w.roles || {}).forEach(([k, v]) => {
            const roleName = typeof v === 'object' ? v?.name : v;
            if (!roleName || !ROLE_LABELS[k]) return;
            add(roleName, ROLE_LABELS[k]);
            trackedThisWeek.add(roleName);
        });
        (w.considerations || []).forEach(v => {
            if (!v) return;
            add(v, 'Consideração');
            trackedThisWeek.add(v);
        });
        (w.nvcAssignments || []).forEach(a => {
            if (!a.value) return;
            add(a.value, a.part ? `NVC (${a.part})` : 'Parte NVC');
            trackedThisWeek.add(a.value);
        });
        (w.existingAssignedNames || []).forEach(n => {
            if (!n || trackedThisWeek.has(n)) return;
            add(n, n === w.existing?.leitura ? 'Leitura da Bíblia' : 'Outra parte (documento original)');
            trackedThisWeek.add(n);
        });
    }
    return b;
}

function renderBalance() {
    const m = state.weeks.find(w => w.dateStart)?.dateStart?.slice(0,7) || '';
    const breakdown = buildRoleBreakdown(m);
    const html = active().map(n => {
        const c = state.history[m]?.[n] || 0;
        const parts = breakdown[n] || {};
        const desc = Object.entries(parts).map(([label, count]) => `${label}: ${count}`).join(', ') || 'Nenhuma designação';
        return `<div class="item balance-item">
            <div class="balance-head"><strong>${esc(n)}</strong><span class="muted">total: ${c}</span></div>
            <div class="breakdown">${esc(desc)}</div>
        </div>`;
    }).join('');
    $('balance').innerHTML = html || '<div class="muted">Envie uma programação.</div>';
}

function setRole(id, k, v) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    w.roles ??= {};
    w.roles[k] = v ? { name: v, manual: true } : { name: '', manual: false };
    if (k === 'presidencia') {
        w.roles.oracaoInicial = v ? { name: v, manual: true } : { name: '', manual: false };
    }
    rebuildHistory();
    const { stuck, reallocated } = autoResolve({ type: 'role', weekId: id, key: k });
    save();
    render();
    if (reallocated) {
        msg('ok', `Designação atualizada. Outra parte de ${v} foi realocada automaticamente nesta semana.`);
    } else if (stuck) {
        msg('warn', 'Designação atualizada, mas ' + stuck + ' outra(s) não puderam ser reorganizadas automaticamente — confira manualmente.');
    }
}

function setNecLocaisSelect(id, name) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    w.roles ??= {};
    w.roles.necessidadesLocais = name ? { name, manual: true } : '';
    rebuildHistory();
    const { stuck, reallocated } = autoResolve({ type: 'role', weekId: id, key: 'necessidadesLocais' });
    save();
    render();
    if (reallocated) {
        msg('ok', `Necessidades Locais definida. Outra parte de ${name} foi realocada automaticamente.`);
    } else if (stuck) {
        msg('warn', 'Designação atualizada, mas ' + stuck + ' outra(s) não puderam ser reorganizadas automaticamente — confira manualmente.');
    }
}

function setText(id, k, v) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    w.roles ??= {};
    w.roles[k] = v;
    rebuildHistory();
    const { stuck, reallocated } = autoResolve({ type: 'role', weekId: id, key: k });
    save();
    render();
}

function setNvc(id, rowIndex, value) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    w.nvcAssignments ??= [];
    let a = w.nvcAssignments.find(x => x.rowIndex === rowIndex);
    const slot = (w.nvcSlots || []).find(x => x.rowIndex === rowIndex);
    if (!a) {
        a = { slotId: slot?.slotId || `nvc-${rowIndex}`, rowIndex, part: slot?.part, value: '', manual: false };
        w.nvcAssignments.push(a);
    }
    a.value = value;
    a.manual = !!value;
    rebuildHistory();
    const { stuck, reallocated } = autoResolve({ type: 'nvc', weekId: id, rowIndex });
    save();
    render();
    if (reallocated) {
        msg('ok', `Parte NVC definida. Outra parte de ${value} foi realocada automaticamente.`);
    } else if (stuck) {
        msg('warn', 'Designação atualizada, mas ' + stuck + ' outra(s) não puderam ser reorganizadas automaticamente — confira manualmente.');
    }
}

function setCons(id, i, v) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    w.considerations ??= [];
    w.considerations[i] = v;
    rebuildHistory();
    const { stuck } = autoResolve(null);
    save();
    render();
    if (stuck) {
        msg('warn', 'Designação atualizada, mas ' + stuck + ' outra(s) não puderam ser reorganizadas automaticamente — confira manualmente.');
    }
}

function addCons(id) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    w.considerations ??= [];
    w.considerations.push('');
    save();
    render();
}

function autoOne(id) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    autoWeek(w);
    applySpecials();
    save();
    render();
    msg('ok', 'Semana preenchida. Revise os nomes antes de exportar.');
}

function rebalanceAll() {
    if (!state.weeks.length) return msg('warn', 'Envie um DOCX primeiro.');

    // 1. Limpa todas as designações automáticas (mantendo as manuais)
    for (const w of state.weeks) {
        if (w.skipped) continue;
        w.roles ??= {};
        for (const [k] of ROLE_AUTO_DEFS) {
            if (w.roles[k] && !w.roles[k].manual) {
                w.roles[k] = { name: '', manual: false };
            }
        }
        if (w.roles.oracaoInicial && !w.roles.oracaoInicial.manual) {
            w.roles.oracaoInicial = { name: '', manual: false };
        }
        if (w.roles.necessidadesLocais && typeof w.roles.necessidadesLocais === 'object' && !w.roles.necessidadesLocais.manual) {
            w.roles.necessidadesLocais = '';
        }
        (w.nvcAssignments || []).forEach(a => {
            if (!a.manual) a.value = '';
        });
    }

    rebuildHistory();

    // Pass 1: Presidência
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (!w.roles?.presidencia?.name) {
            const n = pick(w, 'president', false, 'presidencia');
            if (n) {
                w.roles.presidencia = { name: n, manual: false };
                if (!w.roles.oracaoInicial?.manual) w.roles.oracaoInicial = { name: n, manual: false };
            }
            rebuildHistory();
        }
    }

    // Pass 2: Dirigente EBC (garante anciãos diferentes para cada semana)
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (!w.roles?.dirigenteEbc?.name) {
            const n = pick(w, 'dirigente', false, 'dirigenteEbc');
            if (n) w.roles.dirigenteEbc = { name: n, manual: false };
            rebuildHistory();
        }
    }

    // Pass 3: Joias Espirituais (garante irmãos diferentes para cada semana)
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (!w.roles?.joias?.name) {
            const n = pick(w, 'joias', false, 'joias');
            if (n) w.roles.joias = { name: n, manual: false };
            rebuildHistory();
        }
    }

    // Pass 4: Discurso 1 (garante irmãos diferentes para cada semana)
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (!w.roles?.discurso1?.name) {
            const n = pick(w, 'discurso1', true, 'discurso1');
            if (n) w.roles.discurso1 = { name: n, manual: false };
            rebuildHistory();
        }
    }

    // Pass 5: NVC Slots
    for (const w of state.weeks) {
        if (w.skipped) continue;
        const slots = (w.nvcSlots || []).filter(s => s.assignable !== false);
        for (const slot of slots) {
            let assignment = w.nvcAssignments.find(a => a.slotId === slot.slotId || a.rowIndex === slot.rowIndex);
            if (!assignment) {
                assignment = { slotId: slot.slotId, rowIndex: slot.rowIndex, part: slot.part, value: '', manual: false };
                w.nvcAssignments.push(assignment);
            }
            if (!assignment.value) {
                const n = pick(w, 'nvc', false, 'nvc:' + (slot.part || 'geral'));
                if (n) {
                    assignment.value = n;
                    assignment.manual = false;
                    rebuildHistory();
                }
            }
        }
    }

    // Pass 6: Leitor EBC
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (!w.roles?.leitorEbc?.name) {
            const n = pick(w, 'reader', false, 'leitorEbc');
            if (n) w.roles.leitorEbc = { name: n, manual: false };
            rebuildHistory();
        }
    }

    // Pass 7: Oração Final
    for (const w of state.weeks) {
        if (w.skipped) continue;
        if (!w.roles?.oracaoFinal?.name) {
            const n = pick(w, 'both', false, 'oracaoFinal');
            if (n) w.roles.oracaoFinal = { name: n, manual: false };
            rebuildHistory();
        }
    }

    applySpecials();
    save();
    render();
    msg('ok', 'Distribuição concluída com sucesso: partes diferentes por irmão, máximo 3 partes no mês e sem repetições na mesma semana.');
}

function autoAll() {
    rebalanceAll();
}

function autoResolve(protect) {
    let fixed = 0, stuck = 0, reallocated = 0;
    for (const w of state.weeks) {
        if (w.skipped) continue;
        rebuildHistory();

        for (const [k, p, r] of ROLE_AUTO_DEFS) {
            if (protect && protect.type === 'role' && protect.weekId === w.id && protect.key === k) continue;

            const entry = w.roles?.[k];
            if (!entry || entry.manual) continue;

            const val = entry.name || '';
            const isConflict = conflicts(w).includes(val);
            if (!isConflict && !isRedundant(w, k, val)) continue;

            w.roles[k] = { name: '', manual: false };
            rebuildHistory();
            const n = pick(w, p, r, k);
            if (n) {
                w.roles[k] = { name: n, manual: false };
                if (k === 'presidencia') w.roles.oracaoInicial = { name: n, manual: false };
                fixed++;
                if (isConflict) reallocated++;
            } else {
                w.roles[k] = { name: val, manual: false };
                stuck++;
            }
            rebuildHistory();
        }

        for (const a of (w.nvcAssignments || [])) {
            if (protect && protect.type === 'nvc' && protect.weekId === w.id && protect.rowIndex === a.rowIndex) continue;
            if (a.manual) continue;

            const isConflict = conflicts(w).includes(a.value);
            const roleKey = 'nvc:' + (a.part || 'geral');
            if (!isConflict && !isRedundant(w, roleKey, a.value)) continue;

            const old = a.value;
            a.value = '';
            rebuildHistory();
            const n = pick(w, 'nvc', false, roleKey);
            if (n) {
                a.value = n;
                a.manual = false;
                fixed++;
                if (isConflict) reallocated++;
            } else {
                a.value = old;
                stuck++;
            }
            rebuildHistory();
        }
    }
    return { fixed, stuck, reallocated };
}

function fixAllIssues() {
    rebalanceAll();
}

function clearOne(id) {
    const w = state.weeks.find(x => x.id === id);
    if (!w) return;
    for (const k of ['presidencia','oracaoInicial','oracaoFinal','discurso1','joias','dirigenteEbc','leitorEbc','necessidadesLocais']) {
        if (w.roles) w.roles[k] = { name: '', manual: false };
    }
    w.considerations = (w.considerations || []).map(() => '');
    w.nvcAssignments = (w.nvcAssignments || []).map(a => ({ ...a, value: '' }));
    save();
    render();
}

function toggleMember(n) {
    const i = people.inactive.indexOf(n);
    if (i >= 0) people.inactive.splice(i, 1);
    else people.inactive.push(n);
    save();
    render();
}

function addMember() {
    const n = $('memberName').value.trim();
    const k = $('memberType').value;
    if (!n) return msg('warn', 'Informe o nome.');
    if (all().includes(n)) return msg('warn', 'Esse nome já está cadastrado.');
    people[k === 'elder' ? 'elders' : 'servos'].push(n);
    $('memberName').value = '';
    save();
    render();
}

function addUnav() {
    const n = $('unavName').value;
    const s = $('unavScope').value;
    if (!n) return;
    const isMonth = s === 'month';
    state.unavs.push({
        name: n,
        scope: s,
        month: state.weeks.find(w => w.dateStart)?.dateStart?.slice(0,7) || '',
        weekId: isMonth ? null : Number($('unavWeek').value),
        duration: isMonth ? null : Number(s)
    });
    save();
    render();
}

function removeUnav(i) {
    state.unavs.splice(i, 1);
    save();
    render();
}

function addSpecial() {
    const s = $('sdStart').value;
    const e = $('sdEnd').value;
    const l = $('sdLabel').value;
    if (!s || !e) return msg('warn', 'Informe início e fim.');
    state.specials.push({ start: s, end: e, label: l });
    applySpecials();
    save();
    render();
}

function removeSpecial(i) {
    state.specials.splice(i, 1);
    applySpecials();
    save();
    render();
}

function applySpecials() {
    state.weeks.forEach(w => {
        const h = state.specials.find(s => w.dateStart >= s.start && w.dateStart <= s.end);
        w.skipped = !!h;
        w.skipReason = h?.label || '';
    });
}

function msg(t, s) {
    $('msg').innerHTML = `<div class="msg ${t}">${esc(s)}</div>`;
    setTimeout(() => { $('msg').innerHTML = ''; }, 4500);
}

$('file').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
        msg('info', 'Processando arquivo DOCX...');
        const fd = new FormData();
        fd.append('file', f);
        const r = await fetch('/api/parse', { method: 'POST', body: fd });
        const d = await r.json();
        if (!r.ok) return msg('warn', d.error || 'Erro ao processar arquivo.');
        state.weeks = d.weeks.map(w => ({
            ...w,
            roles: {},
            considerations: Array(w.considerationSlots || 0).fill(''),
            nvcAssignments: (w.nvcSlots || []).map(s => ({ slotId: s.slotId, rowIndex: s.rowIndex, part: s.part, value: s.current || '', manual: false }))
        }));
        state.fileHex = d.fileBase64;
        state.filename = d.filename;
        applySpecials();
        render();
        msg('ok', `${state.weeks.length} semanas encontradas. O conteúdo original foi preservado e as pessoas já designadas foram bloqueadas.`);
    } catch (err) {
        console.error(err);
        msg('warn', 'Erro de conexão ao enviar o arquivo. Verifique se o servidor está ativo.');
    }
};

$('auto').onclick = autoAll;
$('rebalance').onclick = fixAllIssues;
$('addMember').onclick = addMember;
$('addUnav').onclick = addUnav;
$('addSpecial').onclick = addSpecial;
$('unavScope').onchange = e => {
    const isWeek = e.target.value !== 'month';
    $('weekWrap').classList.toggle('hidden', !isWeek);
};

$('export').onclick = async () => {
    if (!state.fileHex) return msg('warn', 'Envie primeiro o DOCX original.');
    rebuildHistory();
    const bad = state.weeks.filter(w => !w.skipped && conflicts(w).length);
    if (bad.length) return msg('warn', 'Corrija os conflitos antes de baixar: ' + bad.map(w => w.label).join(', '));
    try {
        msg('info', 'Gerando arquivo DOCX preenchido...');
        const r = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileHex: state.fileHex, filename: state.filename, weeks: state.weeks })
        });
        if (!r.ok) {
            const d = await r.json();
            return msg('warn', d.error || 'Falha ao exportar.');
        }
        const blob = await r.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (state.filename || 'programacao').replace(/\.docx$/i, '') + '_preenchida.docx';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        msg('ok', 'DOCX preenchido gerado usando o arquivo original como base.');
    } catch (err) {
        console.error(err);
        msg('warn', 'Erro de comunicação ao gerar o arquivo de exportação.');
    }
};

render();
