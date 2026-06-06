#!/usr/bin/env node

/**
 * IT-005: 测试 Resume 工作流
 * 验证 resumeTerminal 创建新 PTY + resume 命令
 */

import { TerminalManager } from '../../dist/terminal-manager.js';

console.log('='.repeat(80));
console.log('测试：Resume 工作流');
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

async function test1_ResumeTerminalCreation() {
  console.log('测试 1: Resume 创建新终端');
  console.log('-'.repeat(80));

  try {
    const result = await manager.resumeTerminal({
      sessionId: 'test-session-123',
      cwd: process.cwd(),
      readyTimeoutMs: 5000
    });

    console.log(`✓ 创建终端: ${result.terminalId}`);
    console.log(`✓ 初始化状态: ${result.init.status}`);
    console.log(`✓ 耗时: ${result.init.elapsedMs}ms`);

    // Resume creates a new PTY (not PTY resurrection)
    const session = manager.getTerminalInfo(result.terminalId);
    if (session && session.status === 'active') {
      console.log('✅ 测试通过：新终端创建成功');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：终端不活跃');
      testsFailed++;
    }

    // Init status should reflect the resume attempt
    if (result.init.status) {
      console.log(`✅ 测试通过：初始化状态=${result.init.status}`);
      testsPassed++;
    } else {
      console.error('❌ 测试失败：无初始化状态');
      testsFailed++;
    }

    await manager.killTerminal(result.terminalId);
    console.log('✓ 终端已清理');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed += 2;
  }

  console.log();
}

async function test2_ResumeWithInitCommands() {
  console.log('测试 2: Resume 带初始化命令');
  console.log('-'.repeat(80));

  try {
    const result = await manager.resumeTerminal({
      sessionId: 'test-session-456',
      cwd: process.cwd(),
      initCommands: ['echo RESUME_INIT_1', 'echo RESUME_INIT_2'],
      readyTimeoutMs: 5000
    });

    console.log(`✓ 创建终端: ${result.terminalId}`);
    console.log(`✓ 初始化状态: ${result.init.status}`);

    if (result.terminalId) {
      console.log('✅ 测试通过：带初始化命令的 resume 成功');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：resume 失败');
      testsFailed++;
    }

    await manager.killTerminal(result.terminalId);
    console.log('✓ 终端已清理');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed++;
  }

  console.log();
}

async function test3_ResumeNewPTY() {
  console.log('测试 3: Resume 创建新 PTY（非 PTY 复活）');
  console.log('-'.repeat(80));

  try {
    // Create first terminal
    const terminal1 = await manager.createTerminal();
    console.log(`✓ 原始终端: ${terminal1}`);

    // Resume with a session ID creates a NEW terminal
    const result = await manager.resumeTerminal({
      sessionId: 'test-session-789',
      cwd: process.cwd()
    });
    console.log(`✓ Resume 终端: ${result.terminalId}`);

    // Verify they are different terminals
    if (result.terminalId !== terminal1) {
      console.log('✅ 测试通过：Resume 创建了新终端（不同于原始终端）');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：Resume 返回了相同的终端 ID');
      testsFailed++;
    }

    // Both terminals should exist
    const session1 = manager.getTerminalInfo(terminal1);
    const session2 = manager.getTerminalInfo(result.terminalId);
    if (session1 && session2) {
      console.log('✅ 测试通过：两个终端都存在');
      testsPassed++;
    } else {
      console.error('❌ 测试失败：终端不存在');
      testsFailed++;
    }

    await manager.killTerminal(terminal1);
    await manager.killTerminal(result.terminalId);
    console.log('✓ 终端已清理');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    testsFailed += 2;
  }

  console.log();
}

// Run all tests
(async () => {
  await test1_ResumeTerminalCreation();
  await test2_ResumeWithInitCommands();
  await test3_ResumeNewPTY();

  console.log('='.repeat(80));
  console.log(`测试结果: ${testsPassed} 通过, ${testsFailed} 失败`);
  console.log('='.repeat(80));

  await manager.shutdown();
  process.exit(testsFailed > 0 ? 1 : 0);
})();
