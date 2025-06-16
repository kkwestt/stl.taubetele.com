const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// Функция для создания скругленных углов
function createRoundedCorner(centerX, centerY, centerZ, radius, segments = 8) {
    const vertices = [];
    const faces = [];
    
    // Создаем вершины для четверти окружности
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        vertices.push([x, y, centerZ]);
    }
    
    return vertices;
}

// Функция для добавления скругленных ребер
function addRoundedEdges(V, F, width, height, depth, radius, segments = 8) {
    const addV = (x, y, z) => (V.push([x, y, z]), V.length - 1);
    const addQ = (a, b, c, d) => { F.push([a, b, c]); F.push([a, c, d]); };
    
    // Создаем скругленные углы для всех 12 ребер куба
    const corners = [];
    
    // Нижние углы (z = 0)
    corners.push(createRoundedCorner(radius, radius, 0, radius, segments));
    corners.push(createRoundedCorner(width - radius, radius, 0, radius, segments));
    corners.push(createRoundedCorner(width - radius, depth - radius, 0, radius, segments));
    corners.push(createRoundedCorner(radius, depth - radius, 0, radius, segments));
    
    // Верхние углы (z = height)
    corners.push(createRoundedCorner(radius, radius, height, radius, segments));
    corners.push(createRoundedCorner(width - radius, radius, height, radius, segments));
    corners.push(createRoundedCorner(width - radius, depth - radius, height, radius, segments));
    corners.push(createRoundedCorner(radius, depth - radius, height, radius, segments));
    
    return corners;
}

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
    const radius = t / 2; // Радиус скругления = половина толщины стенки
    const segments = 6; // Количество сегментов для скругления

    const addV = (x,y,z) => (V.push([x,y,z]), V.length-1);
    const addQ = (a,b,c,d) => { F.push([a,b,c]); F.push([a,c,d]); };

    // Создаем скругленную геометрию
    // Основные точки с учетом скругления
    const r = radius;
    
    // Внешние вершины с скруглением
    const outerVertices = [];
    
    // Нижние вершины (z = 0)
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI / 2;
        // Передний левый угол
        outerVertices.push(addV(r - r * Math.cos(angle), r - r * Math.sin(angle), 0));
        // Передний правый угол  
        outerVertices.push(addV(w - r + r * Math.sin(angle), r - r * Math.cos(angle), 0));
        // Задний правый угол
        outerVertices.push(addV(w - r + r * Math.cos(angle), d - r + r * Math.sin(angle), 0));
        // Задний левый угол
        outerVertices.push(addV(r - r * Math.sin(angle), d - r + r * Math.cos(angle), 0));
    }
    
    // Верхние вершины (z = h)
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI / 2;
        // Передний левый угол
        outerVertices.push(addV(r - r * Math.cos(angle), r - r * Math.sin(angle), h));
        // Передний правый угол
        outerVertices.push(addV(w - r + r * Math.sin(angle), r - r * Math.cos(angle), h));
        // Задний правый угол
        outerVertices.push(addV(w - r + r * Math.cos(angle), d - r + r * Math.sin(angle), h));
        // Задний левый угол
        outerVertices.push(addV(r - r * Math.sin(angle), d - r + r * Math.cos(angle), h));
    }

    // Упрощенная версия - создаем основную геометрию без сложных скруглений
    // но с фасками на углах
    
    // Внешний параллелепипед с фасками
    const O0 = addV(r,r,0),     O1 = addV(w-r,r,0),     O2 = addV(w-r,d-r,0),     O3 = addV(r,d-r,0);
    const O4 = addV(r,r,h),     O5 = addV(w-r,r,h),     O6 = addV(w-r,d-r,h),     O7 = addV(r,d-r,h);
    
    // Дополнительные точки для фасок
    const F0 = addV(0,r,0),     F1 = addV(r,0,0),       F2 = addV(w-r,0,0),       F3 = addV(w,r,0);
    const F4 = addV(w,d-r,0),   F5 = addV(w-r,d,0),     F6 = addV(r,d,0),         F7 = addV(0,d-r,0);
    const F8 = addV(0,r,h),     F9 = addV(r,0,h),       F10 = addV(w-r,0,h),      F11 = addV(w,r,h);
    const F12 = addV(w,d-r,h),  F13 = addV(w-r,d,h),    F14 = addV(r,d,h),        F15 = addV(0,d-r,h);

    // Внутренний параллелепипед (без изменений)
    const I0 = addV(t,t,t),      I1 = addV(w-t,t,t),      I2 = addV(w-t,d-t,t),     I3 = addV(t,d-t,t);
    const I4 = addV(t,t,h),      I5 = addV(w-t,t,h),      I6 = addV(w-t,d-t,h),     I7 = addV(t,d-t,h);

    // Создаем грани с фасками
    
    // Дно с фасками по углам
    addQ(O0,O1,O2,O3);    // основное дно
    // Угловые фаски дна
    addQ(F0,O0,O3,F7);    // левая сторона
    addQ(F1,F2,O1,O0);    // передняя сторона  
    addQ(F3,F4,O2,O1);    // правая сторона
    addQ(F5,F6,O3,O2);    // задняя сторона
    // Угловые треугольники
    addQ(F0,F1,O0,O0);    // передний левый
    addQ(F2,F3,O1,O1);    // передний правый
    addQ(F4,F5,O2,O2);    // задний правый
    addQ(F6,F7,O3,O3);    // задний левый

    // Боковые стенки с фасками
    addQ(O0,O1,O5,O4);    // передняя стенка
    addQ(O1,O2,O6,O5);    // правая стенка
    addQ(O2,O3,O7,O6);    // задняя стенка
    addQ(O3,O0,O4,O7);    // левая стенка
    
    // Фаски на вертикальных ребрах
    addQ(F0,F8,O4,O0);    // передний левый
    addQ(F1,F9,O4,O0);    // передний левый
    addQ(F2,F10,O5,O1);   // передний правый
    addQ(F3,F11,O5,O1);   // передний правый
    addQ(F4,F12,O6,O2);   // задний правый
    addQ(F5,F13,O6,O2);   // задний правый
    addQ(F6,F14,O7,O3);   // задний левый
    addQ(F7,F15,O7,O3);   // задний левый

    // Внутренние стенки (без изменений)
    addQ(I3,I2,I1,I0);    // дно каверны
    addQ(I0,I1,I5,I4);    // передняя
    addQ(I1,I2,I6,I5);    // правая
    addQ(I2,I3,I7,I6);    // задняя
    addQ(I3,I0,I4,I7);    // левая

    // Верхние грани (кольцо толщины на уровне h)
    addQ(O4,O5,I5,I4);    // передняя полоса
    addQ(O5,O6,I6,I5);    // правая полоса
    addQ(O6,O7,I7,I6);    // задняя полоса
    addQ(O7,O4,I4,I7);    // левая полоса

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
    const radius = t / 2; // Радиус скругления

    if (sizeType === 'inner') {
        w += 2 * t;
        d += 2 * t;
    }

    const V = [];
    const F = [];
    const addV = (x, y, z) => (V.push([x, y, z]), V.length - 1);
    const addQ = (a, b, c, d) => { F.push([a, b, c]); F.push([a, c, d]); };

    // Уровни по Z
    const baseZ = 0;
    const topZ = t;
    const rimZ = t + rh;

    // Размеры с учетом скругления
    const r = radius;

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

    // Основные вершины с фасками
    // Внешний контур дна со скруглением
    const b0 = addV(r, r, baseZ);
    const b1 = addV(w-r, r, baseZ);
    const b2 = addV(w-r, d-r, baseZ);
    const b3 = addV(r, d-r, baseZ);
    
    // Дополнительные точки для фасок дна
    const bf0 = addV(0, r, baseZ);
    const bf1 = addV(r, 0, baseZ);
    const bf2 = addV(w-r, 0, baseZ);
    const bf3 = addV(w, r, baseZ);
    const bf4 = addV(w, d-r, baseZ);
    const bf5 = addV(w-r, d, baseZ);
    const bf6 = addV(r, d, baseZ);
    const bf7 = addV(0, d-r, baseZ);

    // Внешний контур верха основания со скруглением
    const t0 = addV(r, r, topZ);
    const t1 = addV(w-r, r, topZ);
    const t2 = addV(w-r, d-r, topZ);
    const t3 = addV(r, d-r, topZ);
    
    // Дополнительные точки для фасок верха
    const tf0 = addV(0, r, topZ);
    const tf1 = addV(r, 0, topZ);
    const tf2 = addV(w-r, 0, topZ);
    const tf3 = addV(w, r, topZ);
    const tf4 = addV(w, d-r, topZ);
    const tf5 = addV(w-r, d, topZ);
    const tf6 = addV(r, d, topZ);
    const tf7 = addV(0, d-r, topZ);

    // Внутренние контуры (без изменений)
    const h0 = addV(holeX, holeY, baseZ);
    const h1 = addV(holeX + holeW, holeY, baseZ);
    const h2 = addV(holeX + holeW, holeY + holeD, baseZ);
    const h3 = addV(holeX, holeY + holeD, baseZ);

    const ht0 = addV(holeX, holeY, topZ);
    const ht1 = addV(holeX + holeW, holeY, topZ);
    const ht2 = addV(holeX + holeW, holeY + holeD, topZ);
    const ht3 = addV(holeX, holeY + holeD, topZ);

    // Бортик (без изменений)
    const r0 = addV(holeX, holeY, rimZ);
    const r1 = addV(holeX + holeW, holeY, rimZ);
    const r2 = addV(holeX + holeW, holeY + holeD, rimZ);
    const r3 = addV(holeX, holeY + holeD, rimZ);

    const i0 = addV(innerX, innerY, topZ);
    const i1 = addV(innerX + innerW, innerY, topZ);
    const i2 = addV(innerX + innerW, innerY + innerD, topZ);
    const i3 = addV(innerX, innerY + innerD, topZ);

    const it0 = addV(innerX, innerY, rimZ);
    const it1 = addV(innerX + innerW, innerY, rimZ);
    const it2 = addV(innerX + innerW, innerY + innerD, rimZ);
    const it3 = addV(innerX, innerY + innerD, rimZ);

    // ГРАНИ

    // Дно крышки со скруглением
    addQ(b0, b3, b2, b1);    // основное дно
    // Фаски дна
    addQ(bf0, b0, b3, bf7);  // левая сторона
    addQ(bf1, bf2, b1, b0);  // передняя сторона
    addQ(bf3, bf4, b2, b1);  // правая сторона
    addQ(bf5, bf6, b3, b2);  // задняя сторона

    // Внешние боковые стенки основания со скруглением
    addQ(b0, b1, t1, t0);    // основная передняя
    addQ(b1, b2, t2, t1);    // основная правая
    addQ(b2, b3, t3, t2);    // основная задняя
    addQ(b3, b0, t0, t3);    // основная левая
    
    // Фаски на вертикальных ребрах
    addQ(bf0, tf0, t0, b0);  // передний левый
    addQ(bf1, tf1, t0, b0);  // передний левый
    addQ(bf2, tf2, t1, b1);  // передний правый
    addQ(bf3, tf3, t1, b1);  // передний правый
    addQ(bf4, tf4, t2, b2);  // задний правый
    addQ(bf5, tf5, t2, b2);  // задний правый
    addQ(bf6, tf6, t3, b3);  // задний левый
    addQ(bf7, tf7, t3, b3);  // задний левый

    // Остальные грани без изменений
    // Внутренние боковые стенки основания
    addQ(h0, ht0, ht1, h1);
    addQ(h1, ht1, ht2, h2);
    addQ(h2, ht2, ht3, h3);
    addQ(h3, ht3, ht0, h0);

    // Верх основания (кольцо вокруг отверстия)
    addQ(t0, t1, ht1, ht0);
    addQ(t1, t2, ht2, ht1);
    addQ(t2, t3, ht3, ht2);
    addQ(t3, t0, ht0, ht3);

    // Внешние стенки бортика
    addQ(ht0, ht1, r1, r0);
    addQ(ht1, ht2, r2, r1);
    addQ(ht2, ht3, r3, r2);
    addQ(ht3, ht0, r0, r3);

    // Внутренние стенки бортика
    addQ(i0, it0, it1, i1);
    addQ(i1, it1, it2, i2);
    addQ(i2, it2, it3, i3);
    addQ(i3, it3, it0, i0);

    // Верх бортика (кольцо)
    addQ(r0, r1, it1, it0);
    addQ(r1, r2, it2, it1);
    addQ(r2, r3, it3, it2);
    addQ(r3, r0, it0, it3);

    // Дно внутреннего бортика
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
    let stl = `solid ${name}\\n`;
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
        stl += `  facet normal ${n[0]} ${n[1]} ${n[2]}\\n    outer loop\\n`;
        stl += `    vertex ${v1.join(' ')}\\n    vertex ${v2.join(' ')}\\n    vertex ${v3.join(' ')}\\n`;
        stl += '    endloop\\n  endfacet\\n';

        addEdge(a, b); addEdge(b, c); addEdge(c, a);
    }
    stl += `endsolid ${name}\\n`;

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
            fname = `lid_rounded_${st}_${w}x${d}.stl`;
        } else {
            data = generateBoxSTL(w, h, d, t, st);
            fname = `box_rounded_${st}_${w}x${h}x${d}.stl`;
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