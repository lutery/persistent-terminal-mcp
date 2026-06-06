#!/usr/bin/env node

/**
 * IT-004: 测试终端状态查询 (get_terminal_status)
 * 验证结构化状态快照、语义状态检测、退出信息
 */

import { TerminalManager } from '../../dist/terminal-manager.js';

// Windows ConPTY skip — node-pty has issues on Windows in standalone scripts
if (process.platform === 'win32') {
  console.log('SKIP: PTY-dependent integration test not supported on Windows node-pty/ConPTY');
  process.exit(0);
}

console.log('='.repeat(80));
console.log('测试：终端状态查询 (get_terminal_status)');
console.log('='.repeat(80));
console.log();

const manager = new TerminalManager({
  maxBufferSize: 10000,
  sessionTimeout: 86400000
});

let testsPassed = 0;
let testsFailed = 0;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test1_ActiveTerminalStatus() {
  console.log('测试 1: 活跃终端状态查询');
  console.log('-'.repeat(80));

  try {
    const terminalId = await manager.createTerminal();
    console.log(`✓ 创建终端: ${terminalId}`);

    await sleep(1000);

    const status = await manager.getTerminalStatus(terminalId);

    console.log(`✓ processStatus: ${status.processStatus}`);
    console.log(`✓ semanticStatus: ${status.semanticStatus}`);
    console.log(`✓ confidence: ${status.semanticStatusConfidence}`);
    console.log(`✓ promptVisible: ${status.promptVisible}`);
    console.log(`✓ cursors: parsed=${status.cursors.parsed}, raw=${status.cursors.raw}`);

    if (status.processStatus === 'active') {
      console.log('✅ 测试通过：processStatus=active');
      testsPassed++;
    } else {
      console.error(`❌ 测试失败：processStatus=${status.processStatus}`);
      testsFailed++;
    }

    if (['unknown', 'running', 'waiting_input'].includes(status.semanticStatus)) {
      console.log('✅ 测试通过：semanticStatus 合理');
      testsPassed++;
    } else {
      console.error(`❌ 测试失败：semanticStatus=${status.semanticStatus}`);
      testsFailed++;
    }

    if (status.semanticStatusConfidence === 'heuristic') {
      console.log('✅ 测试通过：confidence=heuristic');
      testsPassed++;
    } else {
      console.error(`❌ 测试失败：confidence=${status.semanticStatusConfidence}`);
      testsFailed++;
    }

    if (status.exit === null) {
      console.log('✅ 测试通过：活跃终端 exit=null');
      testsPassed++;
    } else {
      console.error(`❌ 测试失败：exit=${JSON.stringify(status.exit)}`);
      testsFailed++;
    }

    await manager.killTerminal(terminalId);
    console.log('✓ 终端已清理');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed += 4;
  }

  console.log();
}

async function test2_StatusWithOutputPreview() {
  console.log('测试 2: 带输出预览的状态查询');
  console.log('-'.repeat(80));

  try {
    const terminalId = await manager.createTerminal();
    console.log(`✓ 创建终端: ${terminalId}`);

    await manager.writeToTerminal({ terminalId, input: 'echo PREVIEW_TEST_DATA' });
    await sleep(1000);

    const status = await manager.getTerminalStatus(terminalId, { includeOutputPreview: true });

    if (status.outputPreview && typeof status.outputPreview === 'string') {
      console.log(`✓ 输出预览长度: ${status.outputPreview.length}`);
      console.log('✅ 测试通过：包含输出预览');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：未包含输出预览');
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

async function test3_StatusNoPreview() {
  console.log('测试 3: 不带输出预览的状态查询');
  console.log('-'.repeat(80));

  try {
    const terminalId = await manager.createTerminal();
    console.log(`✓ 创建终端: ${terminalId}`);

    await sleep(500);

    const status = await manager.getTerminalStatus(terminalId);

    if (status.outputPreview === undefined) {
      console.log('✅ 测试通过：默认不包含输出预览');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：不应包含输出预览');
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

async function test4_NonExistentTerminal() {
  console.log('测试 4: 查询不存在的终端');
  console.log('-'.repeat(80));

  try {
    await manager.getTerminalStatus('non-existent-id-12345');
    console.error('❌ 测试失败：应抛出异常');
    testsFailed++;
  } catch (error) {
    if (error.message.includes('not found')) {
      console.log('✅ 测试通过：不存在的终端抛出 not found');
      testsPassed++;
    } else {
      console.error(`❌ 测试失败：异常消息不正确: ${error.message}`);
      testsFailed++;
    }
  }

  console.log();
}

async function test5_StatusAfterCommand() {
  console.log('测试 5: 执行命令后状态变化');
  console.log('-'.repeat(80));

  try {
    const terminalId = await manager.createTerminal();
    console.log(`✓ 创建终端: ${terminalId}`);

    // Execute a command
    await manager.writeToTerminal({ terminalId, input: 'echo RUNNING_COMMAND' });
    await sleep(1000);

    const status = await manager.getTerminalStatus(terminalId);

    console.log(`✓ processStatus: ${status.processStatus}`);
    console.log(`✓ semanticStatus: ${status.semanticStatus}`);
    console.log(`✓ lastActivity: ${status.lastActivity}`);

    if (status.processStatus === 'active' && status.lastActivity) {
      console.log('✅ 测试通过：命令执行后状态正确');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：命令执行后状态异常');
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

// Run all tests
(async () => {
  await test1_ActiveTerminalStatus();
  await test2_StatusWithOutputPreview();
  await test3_StatusNoPreview();
  await test4_NonExistentTerminal();
  await test5_StatusAfterCommand();

  console.log('='.repeat(80));
  console.log(`测试结果: ${testsPassed} 通过, ${testsFailed} 失败`);
  console.log('='.repeat(80));

  await manager.shutdown();
  process.exit(testsFailed > 0 ? 1 : 0);
})();
