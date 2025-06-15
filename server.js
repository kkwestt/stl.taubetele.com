const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

function generateBoxSTL(width, height, depth, thickness = 2, sizeType = 'outer') {
    let w = +width, h = +height, d = +depth, t = +thickness;
    
    if (sizeType === 'inner') { 
        w += 2*t; 
        h += t; 
        d += 2*t; 
    }
    
    if (t >= w/2 || t >= d/2 || t >= h)
        throw new Error('Слишком большая толщина стенок');

    const V = [];
    const F = [];

    const addV = (x,y,z) => (V.push([x,y,z]), V.length-1);
    const addQ = (a,b,c,d) => { F.push([a,b,c]); F.push([a,c,d]); };

    // Внешний параллелепипед
    const O0 = addV(0,0,0),   O1 = addV(w,0,0),   O2 = addV(w,d,0),   O3 = addV(0,d,0);
    const O4 = addV(0,0,h),   O5 = addV(w,0,h),   O6 = addV(w,d,h),   O7 = addV(0,d,h);

    // Внутренний параллелепипед
    const I0 = addV(t,t,t),     I1 = addV(w-t,t,t),     I2 = addV(w-t,d-t,t),   I3 = addV(t,d-t,t);
    const I4 = addV(t,t,h),     I5 = addV(w-t,t,h),     I6 = addV(w-t,d-t,h),   I7 = addV(t,d-t,h);

    // 1. Внешние грани
    addQ(O0,O1,O2,O3);          // дно
    addQ(O0,O4,O5,O1);          // передняя
    addQ(O1,O5,O6,O2);          // правая
    addQ(O2,O6,O7,O3);          // задняя
    addQ(O3,O7,O4,O0);          // левая

    // 2. Внутренние стенки (нормали внутрь)
    addQ(I3,I2,I1,I0);          // дно каверны
    addQ(I0,I1,I5,I4);          // передняя
    addQ(I1,I2,I6,I5);          // правая
    addQ(I2,I3,I7,I6);          // задняя
    addQ(I3,I0,I4,I7);          // левая

    // 3. ПЛОСКИЕ верхние грани (кольцо толщины на уровне h)
    addQ(O4,O5,I5,I4);          // передняя полоса
    addQ(O5,O6,I6,I5);          // правая полоса
    addQ(O6,O7,I7,I6);          // задняя полоса
    addQ(O7,O4,I4,I7);          // левая полоса

    return {
        vertices: V,
        faces: F,
        dimensions: {
            outer: { width: w, height: h, depth: d },
            inner: { width: w-2*t, height: h-t, depth: d-2*t }
        }
    };
}

function generateLidSTL(width, depth, thickness = 2, clearance = 0.2, rimHeight = null, rimThickness = 1.5, sizeType = 'outer') {
    let w = +width, d = +depth;
    const t = +thickness, c = +clearance;
    const rh = rimHeight === null ? t * 1.5 : +rimHeight;
    const rt = +rimThickness;

    if (sizeType === 'inner') {
        w += 2 * t;
        d += 2 * t;
    }

    const V = [];
    const F = [];
    const addV = (x, y, z) => (V.push([x, y, z]), V.length - 1);
    const addQ = (a, b, c, d) => { F.push([a, b, c]); F.push([a, c, d]); };

    // Уровни по Z
    const baseZ = 0;      // дно крышки
    const topZ = t;       // верх основания крышки
    const rimZ = t + rh;  // верх бортика

    // Размеры отверстия в основании (с зазором)
    const holeX = t + c;
    const holeY = t + c;
    const holeW = w - 2 * t - 2 * c;
    const holeD = d - 2 * t - 2 * c;

    // Размеры внутреннего бортика
    const innerX = holeX + rt;
    const innerY = holeY + rt;
    const innerW = holeW - 2 * rt;
    const innerD = holeD - 2 * rt;

    // 1. ОСНОВАНИЕ КРЫШКИ (дно + стенки)
    // Внешний контур дна
    const b0 = addV(0, 0, baseZ);
    const b1 = addV(w, 0, baseZ);
    const b2 = addV(w, d, baseZ);
    const b3 = addV(0, d, baseZ);

    // Внешний контур верха основания
    const t0 = addV(0, 0, topZ);
    const t1 = addV(w, 0, topZ);
    const t2 = addV(w, d, topZ);
    const t3 = addV(0, d, topZ);

    // Внутренний контур дна (отверстие)
    const h0 = addV(holeX, holeY, baseZ);
    const h1 = addV(holeX + holeW, holeY, baseZ);
    const h2 = addV(holeX + holeW, holeY + holeD, baseZ);
    const h3 = addV(holeX, holeY + holeD, baseZ);

    // Внутренний контур верха основания (отверстие)
    const ht0 = addV(holeX, holeY, topZ);
    const ht1 = addV(holeX + holeW, holeY, topZ);
    const ht2 = addV(holeX + holeW, holeY + holeD, topZ);
    const ht3 = addV(holeX, holeY + holeD, topZ);

    // 2. БОРТИК
    // Внешний контур бортика (верх)
    const r0 = addV(holeX, holeY, rimZ);
    const r1 = addV(holeX + holeW, holeY, rimZ);
    const r2 = addV(holeX + holeW, holeY + holeD, rimZ);
    const r3 = addV(holeX, holeY + holeD, rimZ);

    // Внутренний контур бортика (низ - на уровне topZ)
    const i0 = addV(innerX, innerY, topZ);
    const i1 = addV(innerX + innerW, innerY, topZ);
    const i2 = addV(innerX + innerW, innerY + innerD, topZ);
    const i3 = addV(innerX, innerY + innerD, topZ);

    // Внутренний контур бортика (верх)
    const it0 = addV(innerX, innerY, rimZ);
    const it1 = addV(innerX + innerW, innerY, rimZ);
    const it2 = addV(innerX + innerW, innerY + innerD, rimZ);
    const it3 = addV(innerX, innerY + innerD, rimZ);

    // ГРАНИ

    // Дно крышки (сплошное)
    addQ(b0, b3, b2, b1);

    // Внешние боковые стенки основания
    addQ(b0, b1, t1, t0); // передняя
    addQ(b1, b2, t2, t1); // правая
    addQ(b2, b3, t3, t2); // задняя
    addQ(b3, b0, t0, t3); // левая

    // Внутренние боковые стенки основания (стенки отверстия)
    addQ(h0, ht0, ht1, h1); // передняя
    addQ(h1, ht1, ht2, h2); // правая
    addQ(h2, ht2, ht3, h3); // задняя
    addQ(h3, ht3, ht0, h0); // левая

    // Верх основания (кольцо вокруг отверстия)
    addQ(t0, t1, ht1, ht0); // передняя полоса
    addQ(t1, t2, ht2, ht1); // правая полоса
    addQ(t2, t3, ht3, ht2); // задняя полоса
    addQ(t3, t0, ht0, ht3); // левая полоса

    // Внешние стенки бортика
    addQ(ht0, ht1, r1, r0); // передняя
    addQ(ht1, ht2, r2, r1); // правая
    addQ(ht2, ht3, r3, r2); // задняя
    addQ(ht3, ht0, r0, r3); // левая

    // Внутренние стенки бортика
    addQ(i0, it0, it1, i1); // передняя
    addQ(i1, it1, it2, i2); // правая
    addQ(i2, it2, it3, i3); // задняя
    addQ(i3, it3, it0, i0); // левая

    // Верх бортика (кольцо)
    addQ(r0, r1, it1, it0); // передняя полоса
    addQ(r1, r2, it2, it1); // правая полоса
    addQ(r2, r3, it3, it2); // задняя полоса
    addQ(r3, r0, it0, it3); // левая полоса

    // Дно внутреннего бортика (соединяет внутренний бортик с основанием)
    addQ(i0, i1, i2, i3);

    return {
        vertices: V,
        faces: F,
        dimensions: {
            outer: { width: w, depth: d, height: t + rh },
            inner: { width: w - 2 * t, depth: d - 2 * t },
            rimThickness: rt
        }
    };
}

function createSTLFile(V, F, name = 'model') {
    let stl = `solid ${name}\n`;
    const edgeUse = new Map();

    const addEdge = (a, b) => {
        const k = a < b ? `${a}-${b}` : `${b}-${a}`;
        edgeUse.set(k, (edgeUse.get(k) || 0) + 1);
    };

    for (const [a, b, c] of F) {
        const v1 = V[a], v2 = V[b], v3 = V[c];
        const u = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const v = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];
        const n = [u[1] * v[2] - u[2] * v[1],
                   u[2] * v[0] - u[0] * v[2],
                   u[0] * v[1] - u[1] * v[0]];
        const len = Math.hypot(...n);
        if (len < 1e-12) continue;
        n[0] /= len; n[1] /= len; n[2] /= len;
        stl += `  facet normal ${n[0]} ${n[1]} ${n[2]}\n    outer loop\n`;
        stl += `    vertex ${v1.join(' ')}\n    vertex ${v2.join(' ')}\n    vertex ${v3.join(' ')}\n`;
        stl += '    endloop\n  endfacet\n';

        addEdge(a, b); addEdge(b, c); addEdge(c, a);
    }
    stl += `endsolid ${name}\n`;

    let bad = 0;
    edgeUse.forEach((cnt, e) => {
        if (cnt !== 2) {
            bad++;
            console.log(`Non-manifold edge ${e} (used ${cnt})`);
        }
    });
    console.log(`${name}: ${F.length} faces, ${bad} non-manifold edges`);
    return stl;
}

app.post('/generate-stl', (req, res) => {
    try {
        const { width, height, depth, thickness = 2, type = 'box', clearance = 0.2, rimHeight = null, rimThickness = 1.5, sizeType = 'outer' } = req.body;
        if (!width || !depth || (type === 'box' && !height)) 
            return res.status(400).json({ error: 'Размеры обязательны' });
        
        const w = +width, h = +height, d = +depth, t = +thickness, st = sizeType;

        let data, fname;
        if (type === 'lid') {
            data = generateLidSTL(w, d, t, +clearance, rimHeight ? +rimHeight : null, +rimThickness, st);
            fname = `lid_${st}_${w}x${d}.stl`;
        } else {
            data = generateBoxSTL(w, h, d, t, st);
            fname = `box_${st}_${w}x${h}x${d}.stl`;
        }
        
        const stl = createSTLFile(data.vertices, data.faces, type);
        console.log(`Размеры (${st}):`, data.dimensions);
        
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.send(stl);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));