import { describe, it, expect } from 'vitest';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import projectSchema from '../../../src/schemas/project.schema.json';

describe('project.schema.json', () => {
  it('compiles with Ajv in strict mode without warnings', () => {
    // Provide a logger that turns Ajv strict warnings into thrown errors so the test fails
    // when the schema triggers any strict-mode warnings.
    const ajv = new Ajv({
      allErrors: true,
      strict: true,
      dynamicRef: true,
      allowUnionTypes: true,
      logger: {
        warn: (msg) => {
          throw new Error(String(msg));
        },
        error: () => {},
        log: () => {}
      }
    });

    addFormats(ajv);

    expect(() => ajv.compile(projectSchema)).not.toThrow();
  });
});

