import { type CallExpression, type Expression, isArrayLiteralExpression, isCallExpression, isExpressionStatement, isObjectLiteralExpression, isPropertyAccessExpression, type ObjectLiteralExpression } from "typescript";

import { isDirective, tryParseStringOrNumberLiteral } from "@plexcord-companion/ast-parser/util";
import { Cache, CacheGetter } from "@plexcord-companion/shared/decorators";

import { WebpackChunkParser } from "./WebpackChunkParser";

export class WebpackLazyChunkParser extends WebpackChunkParser {
    @CacheGetter()
    private get pushCall(): CallExpression | undefined {
        const topLevelStatements = this.sourceFile.statements.filter((stmt) => !isDirective(stmt));

        // we only expect one top-level statement
        if (topLevelStatements.length !== 1) {
            return;
        }

        const [stmt] = topLevelStatements;

        if (!isExpressionStatement(stmt)) {
            return;
        }

        const call = stmt.expression;

        if (!isCallExpression(call)) {
            return;
        }

        const { arguments: args, expression: funcExpr } = call;

        // ensure push call
        {
            if (!isPropertyAccessExpression(funcExpr)) {
                return;
            }

            const { expression: _pushToGlobal, name: pushIdent } = funcExpr;

            if (!pushIdent) {
                return;
            }
            if (pushIdent.text !== "push") {
                return;
            }
        }

        if (args.length !== 1) {
            return;
        }

        return call;
    }

    @Cache()
    private assertOneEntry(): [Expression, Expression] | undefined {
        const [arg] = this.pushCall?.arguments ?? [];

        if (!arg || !isArrayLiteralExpression(arg)) {
            return;
        }

        const { elements } = arg;

        if (elements.length !== 2) {
            return;
        }

        const [idTuple, modulesObject] = elements;

        return [idTuple, modulesObject];
    }

    @Cache()
    public override getModuleObject(): ObjectLiteralExpression | undefined {
        const [, modulesArg] = this.assertOneEntry() ?? [];

        if (!modulesArg || !isObjectLiteralExpression(modulesArg)) {
            return;
        }

        return modulesArg;
    }

    @CacheGetter()
    public get chunkId(): string | undefined {
        const [idTuple] = this.assertOneEntry() ?? [];

        if (!idTuple || !isArrayLiteralExpression(idTuple)) {
            return;
        }

        const { elements: [idExpr] } = idTuple;

        return tryParseStringOrNumberLiteral(idExpr);
    }
}
