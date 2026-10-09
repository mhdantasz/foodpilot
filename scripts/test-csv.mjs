import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
// Executa o módulo real; não copia a implementação no teste.
const source=ts.transpileModule(await readFile('src/lib/csv.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {csvCell,csvDocument}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
for(const value of ['+5592999990000','-1+1','@SUM(A1)',' \t=1+1'])assert.ok(csvCell(value).startsWith('"\''));
assert.equal(csvCell(12.5),'"12,50"');assert.equal(csvCell(-12.5),'"-12,50"');
assert.equal(csvCell('Ana; "Doces"\nManaus'),'"Ana; ""Doces""\nManaus"');
assert.equal(csvCell(null),'""');
const csv=csvDocument(['Nome','Valor'],[['João',12.5]]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.endsWith('\r\n'));assert.ok(csv.includes('"João";"12,50"'));
console.log('OK: CSV UTF-8/BOM, pt-BR, quebras/aspas e proteção de fórmulas.');
