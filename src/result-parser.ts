import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import type { ParsedTaskResult, ParseError, ResultParseOutput } from './types.js';

const VALID_STATUSES = ['PASS', 'FAIL', 'ERROR'] as const;
const TASK_RESULT_LOCATOR = /<task_result>[\s\S]*?<\/task_result>/;

export class ResultParser {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: true,
      parseTagValue: false,
      trimValues: true,
      processEntities: false,
      htmlEntities: false,
      commentPropName: false,
      cdataPropName: false,
      alwaysCreateTextNode: false,
      isArray: (name) => {
        return name === 'file' || name === 'error' || name === 'warning';
      }
    });
  }

  locateTaskResultXml(output: string): string | null {
    const match = output.match(TASK_RESULT_LOCATOR);
    return match ? match[0] : null;
  }

  parseTaskResult(xml: string): ResultParseOutput {
    const rawXml = xml;

    try {
      const parsed = this.xmlParser.parse(xml);

      if (!parsed || !parsed.task_result) {
        return {
          parsed: null,
          rawXml,
          errors: [{
            type: 'xml_parse',
            message: 'No task_result root element found'
          }]
        };
      }

      const tr = parsed.task_result;

      // Validate required status field
      if (!tr.status || !VALID_STATUSES.includes(tr.status)) {
        return {
          parsed: null,
          rawXml,
          errors: [{
            type: 'schema_validation',
            message: `Invalid or missing status: "${tr.status}". Must be one of: ${VALID_STATUSES.join(', ')}`
          }]
        };
      }

      const result: ParsedTaskResult = {
        status: tr.status as 'PASS' | 'FAIL' | 'ERROR'
      };

      if (tr.summary !== undefined) {
        result.summary = String(tr.summary);
      }

      if (tr.files) {
        const files = tr.files.file;
        if (Array.isArray(files)) {
          result.files = files.map(String);
        } else if (files !== undefined) {
          result.files = [String(files)];
        }
      }

      if (tr.tests !== undefined) {
        result.tests = String(tr.tests);
      }

      if (tr.duration_ms !== undefined) {
        const ms = Number(tr.duration_ms);
        if (!isNaN(ms) && ms >= 0) {
          result.durationMs = ms;
        }
      }

      if (tr.errors) {
        const errors = tr.errors.error;
        if (Array.isArray(errors)) {
          result.errors = errors.map(String);
        } else if (errors !== undefined) {
          result.errors = [String(errors)];
        }
      }

      if (tr.warnings) {
        const warnings = tr.warnings.warning;
        if (Array.isArray(warnings)) {
          result.warnings = warnings.map(String);
        } else if (warnings !== undefined) {
          result.warnings = [String(warnings)];
        }
      }

      if (tr.notes !== undefined) {
        result.notes = String(tr.notes);
      }

      return {
        parsed: result,
        rawXml,
        errors: []
      };
    } catch (error: any) {
      return {
        parsed: null,
        rawXml,
        errors: [{
          type: 'xml_parse',
          message: error.message || 'Unknown XML parse error'
        }]
      };
    }
  }
}
