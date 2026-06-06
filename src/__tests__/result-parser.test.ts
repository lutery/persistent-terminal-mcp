import { ResultParser } from '../result-parser.js';

describe('ResultParser', () => {
  let parser: ResultParser;

  beforeEach(() => {
    parser = new ResultParser();
  });

  describe('parseTaskResult - valid XML', () => {
    it('should parse PASS result', () => {
      const xml = `<task_result>
  <status>PASS</status>
  <summary>All tests passed</summary>
  <files>
    <file>src/index.ts</file>
    <file>src/types.ts</file>
  </files>
  <tests>42 passed, 0 failed</tests>
  <duration_ms>1234</duration_ms>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed).not.toBeNull();
      expect(result.parsed!.status).toBe('PASS');
      expect(result.parsed!.summary).toBe('All tests passed');
      expect(result.parsed!.files).toEqual(['src/index.ts', 'src/types.ts']);
      expect(result.parsed!.tests).toBe('42 passed, 0 failed');
      expect(result.parsed!.durationMs).toBe(1234);
      expect(result.rawXml).toBe(xml);
      expect(result.errors).toHaveLength(0);
    });

    it('should parse FAIL result with errors', () => {
      const xml = `<task_result>
  <status>FAIL</status>
  <summary>Some tests failed</summary>
  <errors>
    <error>Test case 3 assertion failed</error>
    <error>Timeout in test case 5</error>
  </errors>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed!.status).toBe('FAIL');
      expect(result.parsed!.errors).toEqual([
        'Test case 3 assertion failed',
        'Timeout in test case 5'
      ]);
    });

    it('should parse ERROR result with warnings and notes', () => {
      const xml = `<task_result>
  <status>ERROR</status>
  <summary>Build failed</summary>
  <warnings>
    <warning>Deprecated API usage</warning>
  </warnings>
  <notes>Check compiler logs for details</notes>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed!.status).toBe('ERROR');
      expect(result.parsed!.warnings).toEqual(['Deprecated API usage']);
      expect(result.parsed!.notes).toBe('Check compiler logs for details');
    });
  });

  describe('parseTaskResult - malformed XML', () => {
    it('should return error for missing status', () => {
      const xml = `<task_result>
  <summary>No status field</summary>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('schema_validation');
    });

    it('should return error for invalid status value', () => {
      const xml = `<task_result>
  <status>INVALID</status>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed).toBeNull();
      expect(result.errors.some(e => e.type === 'schema_validation')).toBe(true);
    });

    it('should return error for completely malformed XML', () => {
      const xml = 'this is not xml at all <><><';

      const result = parser.parseTaskResult(xml);

      expect(result.parsed).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('xml_parse');
    });
  });

  describe('parseTaskResult - security', () => {
    it('should reject XML with external entity references', () => {
      const xml = `<?xml version="1.0"?>
<!DOCTYPE task_result [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<task_result>
  <status>PASS</status>
  <summary>&xxe;</summary>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      // Should either reject or not resolve the entity
      // The entity reference should NOT be resolved to file contents
      if (result.parsed) {
        expect(result.parsed.summary).not.toContain('root:');
      }
      // We accept either rejection (error) or safe parsing (entity not resolved)
    });

    it('should reject XML with DTD network access', () => {
      const xml = `<?xml version="1.0"?>
<!DOCTYPE task_result [
  <!ENTITY remote SYSTEM "http://evil.com/steal">
]>
<task_result>
  <status>PASS</status>
  <summary>&remote;</summary>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      // Should not make network request or resolve entity
      if (result.parsed) {
        expect(result.parsed.summary).not.toContain('http://');
      }
    });
  });

  describe('parseTaskResult - optional fields', () => {
    it('should parse with all optional fields present', () => {
      const xml = `<task_result>
  <status>PASS</status>
  <summary>Full result</summary>
  <files>
    <file>a.ts</file>
    <file>b.ts</file>
    <file>c.ts</file>
  </files>
  <tests>10 passed</tests>
  <duration_ms>5678</duration_ms>
  <errors>
    <error>e1</error>
  </errors>
  <warnings>
    <warning>w1</warning>
    <warning>w2</warning>
  </warnings>
  <notes>Some notes</notes>
</task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed!.status).toBe('PASS');
      expect(result.parsed!.summary).toBe('Full result');
      expect(result.parsed!.files).toEqual(['a.ts', 'b.ts', 'c.ts']);
      expect(result.parsed!.tests).toBe('10 passed');
      expect(result.parsed!.durationMs).toBe(5678);
      expect(result.parsed!.errors).toEqual(['e1']);
      expect(result.parsed!.warnings).toEqual(['w1', 'w2']);
      expect(result.parsed!.notes).toBe('Some notes');
    });

    it('should parse with minimal required fields only', () => {
      const xml = `<task_result><status>FAIL</status></task_result>`;

      const result = parser.parseTaskResult(xml);

      expect(result.parsed!.status).toBe('FAIL');
      expect(result.parsed!.summary).toBeUndefined();
      expect(result.parsed!.files).toBeUndefined();
      expect(result.parsed!.durationMs).toBeUndefined();
    });
  });

  describe('locateTaskResultXml', () => {
    it('should find task_result XML block in output', () => {
      const output = `Some output before
<task_result>
  <status>PASS</status>
  <summary>Done</summary>
</task_result>
Some output after`;

      const match = parser.locateTaskResultXml(output);

      expect(match).not.toBeNull();
      expect(match).toContain('<status>PASS</status>');
    });

    it('should return null when no task_result block exists', () => {
      const output = 'Just regular output with no XML';

      const match = parser.locateTaskResultXml(output);

      expect(match).toBeNull();
    });
  });
});
