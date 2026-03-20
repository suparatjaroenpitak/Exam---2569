const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(process.cwd(), 'data');
const questionsPath = path.join(DATA_DIR, 'questions.xlsx');

const map = {
    math: 'Analytical Thinking',
    thai: 'Thai Language',
    english: 'English Language',
    law: 'Government Law & Ethics'
};

function migrate() {
    if (!fs.existsSync(questionsPath)) {
        console.error('questions.xlsx not found');
        process.exit(1);
    }

    const wb = XLSX.readFile(questionsPath);
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    let changed = 0;
    const out = rows.map((r) => {
        const subj = String(r.subject || '').trim();
        const key = subj.toLowerCase();
        if (map[key]) {
            r.subject = map[key];
            r.category = map[key];
            changed++;
        }
        return r;
    });

    if (changed === 0) {
        console.log('No short-code subjects found.');
        return;
    }

    const newWs = XLSX.utils.json_to_sheet(out, { header: Object.keys(out[0]) });
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newWs, sheetName);
    XLSX.writeFile(newWb, questionsPath);
    console.log('Migrated', changed, 'rows.');
}

migrate();