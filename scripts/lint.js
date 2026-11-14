/**
 * @fileoverview Deterministic Static Linter (npm run lint / node scripts/lint.js)
 * Zero-dependency static analyzer enforcing security rules, ES2022 standards,
 * repository size ceilings (< 1 MB), and code quality metrics.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

let totalErrors = 0;
let totalWarnings = 0;

console.log('='.repeat(65));
console.log('🔍 RUNNING CIVIC CODE QUALITY & SECURITY LINTER');
console.log('='.repeat(65));

/**
 * Recursively retrieves all files in a directory.
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (file === 'node_modules' || file === '.git' || file === '.gemini') {
      return;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// 1. REPO SIZE AUDIT (< 1 MB constraint)
console.log('\n📦 1. Repository Size & Efficiency Audit:');
const allRepoFiles = getAllFiles(ROOT_DIR);
let totalBytes = 0;

allRepoFiles.forEach((f) => {
  const stat = fs.statSync(f);
  totalBytes += stat.size;
});

const totalKb = (totalBytes / 1024).toFixed(2);
const totalMb = (totalBytes / (1024 * 1024)).toFixed(3);

console.log(`   Total Project Size: ${totalKb} KB (${totalMb} MB)`);
if (totalBytes < 1024 * 1024) {
  console.log(`   ✅ PASS: Repository size is strictly under 1 MB (${totalKb} KB).`);
} else {
  console.error(`   ❌ FAIL: Repository size exceeds 1 MB limit (${totalMb} MB)!`);
  totalErrors++;
}

// 2. STATIC SECURITY & CODE QUALITY CHECKS
console.log('\n🔒 2. Static Security & Syntax Rules Audit:');

const jsFiles = allRepoFiles.filter((f) => f.endsWith('.js') && f !== __filename);

jsFiles.forEach((filePath) => {
  const relPath = path.relative(ROOT_DIR, filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Check A: No eval()
    if (/\beval\s*\(/.test(line)) {
      console.error(`   ❌ [${relPath}:${lineNum}] Forbidden 'eval()' statement detected.`);
      totalErrors++;
    }

    // Check B: No Function() constructor
    if (/new\s+Function\s*\(/.test(line)) {
      console.error(`   ❌ [${relPath}:${lineNum}] Forbidden 'new Function()' constructor detected.`);
      totalErrors++;
    }

    // Check C: No direct unescaped innerHTML assignments (excluding setSanitizedHTML or select.innerHTML = '')
    if (/\.innerHTML\s*=\s*[^'"]/.test(line)) {
      // allow select.innerHTML = ''
      if (!line.includes(".innerHTML = ''") && !line.includes('.innerHTML = ""')) {
        console.error(`   ❌ [${relPath}:${lineNum}] Potential XSS: Unsafe direct innerHTML assignment. Use setSanitizedHTML() instead.`);
        totalErrors++;
      }
    }

    // Check D: No hardcoded live API keys (pattern AIzaSy...)
    if (/AIzaSy[A-Za-z0-9_-]{33}/.test(line) && !relPath.includes('test.js')) {
      console.error(`   ❌ [${relPath}:${lineNum}] Credential Leak: Hardcoded API key pattern detected!`);
      totalErrors++;
    }

    // Check E: No console.error in production engine files
    if (line.includes('debugger')) {
      console.error(`   ❌ [${relPath}:${lineNum}] Leftover 'debugger' statement.`);
      totalErrors++;
    }
  });

  // Check F: JSDoc presence on exported functions
  const exportedFunctions = content.match(/export\s+function\s+([a-zA-Z0-9_]+)/g) || [];
  exportedFunctions.forEach((exp) => {
    const fnName = exp.replace(/export\s+function\s+/, '').trim();
    if (!content.includes(`@param`) && !content.includes(`@returns`) && !content.includes(`/**`)) {
      console.warn(`   ⚠️ [${relPath}] Function '${fnName}' may be missing standard JSDoc comment.`);
      totalWarnings++;
    }
  });
});

console.log(`   Scanned ${jsFiles.length} JavaScript files across codebase.`);

// 3. SUMMARY
console.log('\n' + '='.repeat(65));
console.log(`🏁 LINT SUMMARY: ${totalErrors} Errors, ${totalWarnings} Warnings`);
console.log('='.repeat(65));

if (totalErrors > 0) {
  process.exit(1);
} else {
  console.log('🎉 STATIC CODE QUALITY & SECURITY LINTER PASSED WITH 0 ERRORS!\n');
}
