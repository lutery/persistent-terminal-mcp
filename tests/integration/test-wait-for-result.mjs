#!/usr/bin/env node

/**
 * IT-003: 测试 XML 结果等待 (wait_for_result)
 * 验证 <task_result> XML 块检测和解析
 */

import { TerminalManager } from '../../dist/terminal-manager.js';
import { ResultParser } from '../../dist/result-parser.js';

// Windows ConPTY skip — node-pty has issues on Windows in standalone scripts
if (process.platform === 'win32') {
  console.log('SKIP: PTY-dependent integration test not supported on Windows node-pty/ConPTY');
  process.exit(0);
}

console.log('='.repeat(80));
console.log('测试：XML 结果等待 (wait_for_result)');
console.log('='.repeat(80));
console.log();

const manager = new TerminalManager({
  maxBufferSize: 10000,
  sessionTimeout: 86400000
});

const parser = new ResultParser();

let testsPassed = 0;
let testsFailed = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test1_TaskResultDetection() {
  console.log('测试 1: 检测 <task_result> XML 块');
  console.log('-'.repeat(80));

  try {
    const terminalId = await manager.createTerminal();
    console.log(`✓ 创建终端: ${terminalId}`);

    // Write XML result to terminal
    await manager.writeToTerminal({
      terminalId,
      input: 'echo <task_result><status>PASS</status><summary>Test passed</summary></task_result>'
    });
    await sleep(1500);

    const waitResult = await manager.waitForPattern({
      terminalId,
      pattern: '<task_result>[\\s\\S]*?</task_result>',
      timeoutMs: 5000,
      pollIntervalMs: 300
    });

    console.log(`✓ 匹配结果: matched=${waitResult.matched}`);

    if (waitResult.matched && waitResult.match) {
      console.log(`✓ 匹配文本: ${waitResult.match.text.substring(0, 100)}...`);
      console.log('✅ 测试通过：XML 块匹配成功');
      testsPassed++;

      // Parse the matched XML
      const parseResult = parser.parseTaskResult(waitResult.match.text);
      if (parseResult.parsed) {
        console.log(`✓ 解析状态: ${parseResult.parsed.status}`);
        console.log(`✓ 摘要: ${parseResult.parsed.summary}`);
        if (parseResult.parsed.status === 'PASS') {
          console.log('✅ 测试通过：XML 解析正确');
          testsPassed++;
        } else {
          console.error(`❌ 测试失败：解析状态=${parseResult.parsed.status}，期望 PASS`);
          testsFailed++;
        }
      } else {
        console.error('❌ 测试失败：XML 解析返回 null');
        console.error('解析错误:', JSON.stringify(parseResult.errors));
        testsFailed++;
      }
    } else {
      console.error(`❌ 测试失败：XML 块匹配失败`);
      testsFailed += 2;
    }

    await manager.killTerminal(terminalId);
    console.log('✓ 终端已清理');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed += 2;
  }

  console.log();
}

async function test2_FailResultParsing() {
  console.log('测试 2: 解析 FAIL 状态的结果');
  console.log('-'.repeat(80));

  try {
    const xml = '<task_result><status>FAIL</status><summary>Build failed</summary><errors><error>Missing dependency</error></errors></task_result>';
    const result = parser.parseTaskResult(xml);

    if (result.parsed && result.parsed.status === 'FAIL') {
      console.log(`✓ 状态: ${result.parsed.status}`);
      console.log(`✓ 摘要: ${result.parsed.summary}`);
      console.log(`✓ 错误: ${JSON.stringify(result.parsed.errors)}`);
      console.log('✅ 测试通过：FAIL 状态解析正确');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：FAIL 状态解析错误');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed++;
  }

  console.log();
}

async function test3_ResultTimeout() {
  console.log('测试 3: 结果等待超时');
  console.log('-'.repeat(80));

  try {
    const terminalId = await manager.createTerminal();
    console.log(`✓ 创建终端: ${terminalId}`);

    const waitResult = await manager.waitForPattern({
      terminalId,
      pattern: '<task_result>[\\s\\S]*?</task_result>',
      timeoutMs: 1500,
      pollIntervalMs: 200
    });

    if (!waitResult.matched && waitResult.timedOut) {
      console.log('✅ 测试通过：无 XML 输出时超时');
      testsPassed++;
    } else {
      console.error(`❌ 测试失败：应超时但 matched=${waitResult.matched}`);
      testsFailed++;
    }

    await manager.killTerminal(terminalId);
    console.log('✓ 终端已清理');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed++;
  }

  console.log();
}

async function test4_ResultParserDirectly() {
  console.log('测试 4: ResultParser 直接测试');
  console.log('-'.repeat(80));

  try {
    // PASS with files
    const xml1 = '<task_result><status>PASS</status><files><file>src/main.ts</file><file>src/test.ts</file></files><duration_ms>5000</duration_ms></task_result>';
    const r1 = parser.parseTaskResult(xml1);
    if (r1.parsed && r1.parsed.status === 'PASS' && r1.parsed.files?.length === 2) {
      console.log('✅ PASS with files 解析正确');
      testsPassed++;
    } else {
      console.error('❌ PASS with files 解析错误');
      testsFailed++;
    }

    // ERROR status
    const xml2 = '<task_result><status>ERROR</status><summary>Unexpected error</summary></task_result>';
    const r2 = parser.parseTaskResult(xml2);
    if (r2.parsed && r2.parsed.status === 'ERROR') {
      console.log('✅ ERROR 状态解析正确');
      testsPassed++;
    } else {
      console.error('❌ ERROR 状态解析错误');
      testsFailed++;
    }

    // Malformed XML
    const xml3 = '<task_result><status>INVALID</status></task_result>';
    const r3 = parser.parseTaskResult(xml3);
    if (!r3.parsed && r3.errors.length > 0) {
      console.log('✅ 无效状态返回解析错误');
      testsPassed++;
    } else {
      console.error('❌ 无效状态应返回错误');
      testsFailed++;
    }

    // locateTaskResultXml
    const output = 'Some output\n<task_result><status>PASS</status></task_result>\nMore output';
    const located = parser.locateTaskResultXml(output);
    if (located) {
      console.log('✅ XML 定位正确');
      testsPassed++;
    } else {
      console.error('❌ XML 定位失败');
      testsFailed++;
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed += 4;
  }

  console.log();
}

// Run all tests
(async () => {
  await test1_TaskResultDetection();
  await test2_FailResultParsing();
  await test3_ResultTimeout();
  await test4_ResultParserDirectly();

  console.log('='.repeat(80));
  console.log(`测试结果: ${testsPassed} 通过, ${testsFailed} 失败`);
  console.log('='.repeat(80));

  await manager.shutdown();
  process.exit(testsFailed > 0 ? 1 : 0);
})();
