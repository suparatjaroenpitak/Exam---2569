const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DATA_DIR = path.join(process.cwd(), 'data');
const importLogPath = path.join(DATA_DIR, 'import_log.json');
const genLogPath = path.join(DATA_DIR, 'generation_logs.xlsx');
const questionsPath = path.join(DATA_DIR, 'questions.xlsx');

function readImportLog() {
    try {
        if (fs.existsSync(importLogPath)) {
            return JSON.parse(fs.readFileSync(importLogPath, 'utf8') || '[]');
        }
    } catch (e) {}
    return [];
}

function readXlsxSheet(filePath, sheetName) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const workbook = XLSX.readFile(filePath);
        const sheet = sheetName || workbook.SheetNames[0];
        if (!sheet) return [];
        const worksheet = workbook.Sheets[sheet];
        if (!worksheet) return [];
        return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    } catch (e) {
        return { error: String(e) };
    }
}

const importLogs = readImportLog();
const genLogs = readXlsxSheet(genLogPath, 'logs');
const questions = readXlsxSheet(questionsPath, 'questions');

const out = {
    importLogs: importLogs.slice(-20),
    generationLogs: Array.isArray(genLogs) ? genLogs.slice(-20) : genLogs,
    totalQuestions: Array.isArray(questions) ? questions.length : 0,
    recentQuestions: Array.isArray(questions) ? questions.slice(-20) : questions
};

console.log(JSON.stringify(out, null, 2));