const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.tsx')) {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk('src/components');
let modifiedFiles = [];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let originalContent = content;
    
    // 1. Add loading="lazy" decoding="async" to all <img> tags that don't have it
    content = content.replace(/<img\s+(?!loading)/g, '<img loading="lazy" decoding="async" ');
    
    // 2. Add transform-gpu to any className that has rounded-full to fix desktop performance bug
    content = content.replace(/(className="[^"]*)(rounded-full)([^"]*")/g, (match, p1, p2, p3) => {
        if (!match.includes('transform-gpu')) {
             return p1 + p2 + ' transform-gpu' + p3;
        }
        return match;
    });

    if (content !== originalContent) {
        fs.writeFileSync(file, content);
        modifiedFiles.push(file);
    }
});

console.log('Modified files:', modifiedFiles);
