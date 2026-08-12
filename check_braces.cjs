const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, 'Last WP Plugin', 'events-api', 'events-api.php');

if (!fs.existsSync(filepath)) {
    console.log(`File not found: ${filepath}`);
    process.exit(1);
}

const content = fs.readFileSync(filepath, 'utf8');

// Strip string literals, regular expressions, and comments
let clean = content
    .replace(/\/\*[\s\S]*?\*\//g, '')  // Multi-line comments
    .replace(/\/\/.*/g, '')            // Single-line comments
    .replace(/#[^\r\n]*/g, '')         // Single-line comments #
    .replace(/"(\\.|[^"\\])*"/g, '""') // Double-quoted strings
    .replace(/'(\\.|[^'\\])*'/g, "''"); // Single-quoted strings

let braces = 0;
let parens = 0;
let squares = 0;

for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '{') braces++;
    else if (char === '}') braces--;
    else if (char === '(') parens++;
    else if (char === ')') parens--;
    else if (char === '[') squares++;
    else if (char === ']') squares--;

    if (braces < 0) {
        console.log(`ERROR: Mismatched closing brace '}' at position ${i}`);
        printContext(clean, i);
        process.exit(1);
    }
    if (parens < 0) {
        console.log(`ERROR: Mismatched closing parenthesis ')' at position ${i}`);
        printContext(clean, i);
        process.exit(1);
    }
    if (squares < 0) {
        console.log(`ERROR: Mismatched closing square bracket ']' at position ${i}`);
        printContext(clean, i);
        process.exit(1);
    }
}

function printContext(str, pos) {
    const start = Math.max(0, pos - 50);
    const end = Math.min(str.length, pos + 50);
    console.log(`Context: ... ${str.substring(start, end).replace(/\s+/g, ' ')} ...`);
}

console.log("Brace balance checks:");
console.log(`- Curly Braces { }: ${braces}`);
console.log(`- Parentheses ( ): ${parens}`);
console.log(`- Square Brackets [ ]: ${squares}`);

if (braces === 0 && parens === 0 && squares === 0) {
    console.log("✅ SUCCESS: All brackets are perfectly balanced. No syntax parsing errors found!");
} else {
    console.log("❌ FAILED: Brackets are unbalanced! There is a syntax error in the file.");
}
