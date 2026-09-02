// Extract a JSON schema for a Raycast tool's `Input` type using the TypeScript compiler API.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export function toolSchema(toolFile) {
  const program = ts.createProgram([toolFile], { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, strict: false, skipLibCheck: true, noResolve: false, allowJs: true });
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(toolFile);
  if (!sf) return { type: 'object', properties: {} };
  let inputType = null;
  // Prefer the parameter type of the default export function.
  ts.forEachChild(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && node.parameters[0]) {
      inputType = checker.getTypeAtLocation(node.parameters[0]);
    }
    if (ts.isExportAssignment(node)) {
      const t = checker.getTypeAtLocation(node.expression);
      const sig = t.getCallSignatures()[0];
      if (sig?.parameters[0]) inputType = checker.getTypeOfSymbolAtLocation(sig.parameters[0], node);
    }
  });
  if (!inputType) {
    ts.forEachChild(sf, (node) => { if (ts.isTypeAliasDeclaration(node) && node.name.text === 'Input') inputType = checker.getTypeAtLocation(node); });
  }
  if (!inputType) return { type: 'object', properties: {} };
  return typeToSchema(inputType, checker, 0);
}

function typeToSchema(type, checker, depth) {
  if (depth > 6) return {};
  const flags = type.getFlags();
  if (flags & ts.TypeFlags.String) return { type: 'string' };
  if (flags & ts.TypeFlags.Number) return { type: 'number' };
  if (flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
  if (flags & ts.TypeFlags.StringLiteral) return { type: 'string', enum: [type.value] };
  if (flags & ts.TypeFlags.NumberLiteral) return { type: 'number', enum: [type.value] };
  if (flags & ts.TypeFlags.BooleanLiteral) return { type: 'boolean' };
  if (type.isUnion()) {
    const members = type.types.filter((t) => !(t.getFlags() & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
    const lits = members.filter((t) => t.isStringLiteral());
    if (lits.length === members.length && lits.length) return { type: 'string', enum: lits.map((t) => t.value) };
    if (members.every((t) => t.getFlags() & ts.TypeFlags.BooleanLiteral)) return { type: 'boolean' };
    if (members.length === 1) return typeToSchema(members[0], checker, depth + 1);
    return { anyOf: members.map((t) => typeToSchema(t, checker, depth + 1)) };
  }
  if (checker.isArrayType(type)) {
    const el = checker.getTypeArguments(type)[0];
    return { type: 'array', items: el ? typeToSchema(el, checker, depth + 1) : {} };
  }
  if (flags & ts.TypeFlags.Object) {
    const props = {}; const required = [];
    for (const sym of type.getProperties()) {
      const decl = sym.valueDeclaration ?? sym.declarations?.[0];
      const t = decl ? checker.getTypeOfSymbolAtLocation(sym, decl) : checker.getDeclaredTypeOfSymbol(sym);
      const s = typeToSchema(t, checker, depth + 1);
      const doc = ts.displayPartsToString(sym.getDocumentationComment(checker)).trim();
      if (doc) s.description = doc;
      props[sym.name] = s;
      const optional = !!(sym.getFlags() & ts.SymbolFlags.Optional) || (decl && decl.questionToken);
      if (!optional) required.push(sym.name);
    }
    const out = { type: 'object', properties: props };
    if (required.length) out.required = required;
    return out;
  }
  return {};
}
