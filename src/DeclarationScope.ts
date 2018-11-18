import * as ts from "typescript";
import * as ESTree from "estree";
import {
  Ranged,
  createDeclaration,
  createReference,
  createIdentifier,
  removeNested,
  withStartEnd,
  convertExpression,
} from "./astHelpers";

const IGNORE_TYPENODES = new Set([
  ts.SyntaxKind.LiteralType,
  ts.SyntaxKind.VoidKeyword,
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.BooleanKeyword,
  ts.SyntaxKind.NumberKeyword,
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.ObjectKeyword,
  ts.SyntaxKind.NullKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.NeverKeyword,
]);

export class DeclarationScope {
  declaration: ESTree.FunctionDeclaration;

  constructor(id: ts.Identifier, range: Ranged) {
    this.declaration = createDeclaration(id, range);
  }

  pushRaw(expr: ESTree.AssignmentPattern) {
    this.declaration.params.push(expr);
  }
  pushReference(id: ESTree.Expression) {
    this.pushRaw(createReference(id));
  }
  pushIdentifierReference(id: ts.Identifier) {
    this.pushReference(createIdentifier(id));
  }

  removeModifier(node: ts.Node, kind: ts.SyntaxKind = ts.SyntaxKind.ExportKeyword) {
    for (const mod of node.modifiers || []) {
      if (mod.kind === kind) {
        const start = node.getStart();
        const end = mod.end + 1;
        this.pushRaw(removeNested({ start, end }));
      }
    }
  }

  convertParametersAndType(node: ts.SignatureDeclarationBase) {
    for (const param of node.parameters) {
      if (param.type) {
        this.convertTypeNode(param.type);
      }
    }
    if (node.type) {
      this.convertTypeNode(node.type);
    }
  }

  convertHeritageClauses(node: ts.InterfaceDeclaration | ts.ClassDeclaration) {
    for (const heritage of node.heritageClauses || []) {
      for (const type of heritage.types) {
        this.pushReference(convertExpression(type.expression));
      }
    }
  }

  convertMembers(node: ts.InterfaceDeclaration | ts.ClassDeclaration) {
    for (const member of node.members) {
      if ((ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) && member.type) {
        this.convertTypeNode(member.type);
      } else if (
        ts.isMethodDeclaration(member) ||
        ts.isMethodSignature(member) ||
        ts.isConstructorDeclaration(member) ||
        ts.isConstructSignatureDeclaration(member)
      ) {
        this.convertParametersAndType(member);
      }
    }
  }

  convertTypeNode(node: ts.TypeNode): any {
    if (IGNORE_TYPENODES.has(node.kind)) {
      return;
    }
    if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) {
      return this.convertTypeNode(node.type);
    }
    if (ts.isArrayTypeNode(node)) {
      return this.convertTypeNode(node.elementType);
    }
    if (ts.isTupleTypeNode(node)) {
      for (const type of node.elementTypes) {
        this.convertTypeNode(type);
      }
      return;
    }
    if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node)) {
      for (const type of node.types) {
        this.convertTypeNode(type);
      }
      return;
    }
    // istanbul ignore else
    if (ts.isTypeReferenceNode(node)) {
      return this.pushReference(this.convertEntityName(node.typeName));
    } else {
      console.log({ kind: node.kind, code: node.getFullText() });
      throw new Error(`Unknown TypeNode`);
    }
  }

  convertEntityName(node: ts.EntityName): ESTree.Expression {
    if (ts.isIdentifier(node)) {
      return createIdentifier(node);
    }
    return withStartEnd(
      {
        type: "MemberExpression",
        computed: false,
        object: this.convertEntityName(node.left),
        property: createIdentifier(node.right),
      },
      // TODO: clean up all the `start` handling!
      { start: node.getStart(), end: node.end },
    );
  }
}