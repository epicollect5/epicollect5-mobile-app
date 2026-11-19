import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
//the rule lives in the flat config (eslint.config.js), not in src/
import { objectOnePropertyPerLine } from '../../../eslint.config.js';

const config = [{
    plugins: {
        local: {
            rules: {
                'object-one-property-per-line': objectOnePropertyPerLine
            }
        }
    },
    rules: {
        'local/object-one-property-per-line': 'error'
    },
    languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    }
}];

const lint = (code) => {
    return new Linter().verify(code, config);
};

describe('object-one-property-per-line', () => {
    it('flags a property sharing a line with the previous one', () => {
        const messages = lint('const o = {\n    a: 1, b: 2,\n    c: 3\n};\n');
        expect(messages).toHaveLength(1);
        expect(messages[0].ruleId).toBe('local/object-one-property-per-line');
        expect(messages[0].line).toBe(2);
    });

    it('flags a method merged onto the previous closing brace', () => {
        //the notification-service churn shape: `}, async b() {`
        const code = 'const o = {\n    a() {\n        return 1;\n    }, async b() {\n        return 2;\n    }\n};\n';
        const messages = lint(code);
        expect(messages).toHaveLength(1);
        expect(messages[0].ruleId).toBe('local/object-one-property-per-line');
        expect(messages[0].line).toBe(4);
    });

    it('allows inline objects', () => {
        expect(lint('const o = {a: 1, b: 2};\n')).toHaveLength(0);
    });

    it('allows properties and methods on their own lines', () => {
        const code = 'const o = {\n    a: 1,\n    async b() {\n        return 2;\n    },\n    c: 3\n};\n';
        expect(lint(code)).toHaveLength(0);
    });
});
