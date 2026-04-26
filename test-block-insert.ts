#!/usr/bin/env npx ts-node
/**
 * Local test script for block insertion
 * Run with: npx ts-node test-block-insert.ts
 */

import { config as dotenvConfig } from 'dotenv';
import { DocmostClient } from './src/client.js';
import {
  buildDrawioNode,
  appendNodeToDocument,
  prependNodeToDocument,
  buildAttachmentUrl,
} from './src/tiptap-helpers.js';

dotenvConfig();

const TEST_PAGE_ID = process.env.TEST_PAGE_ID || '';
const TEST_SPACE_ID = process.env.TEST_SPACE_ID || '';

async function main() {
  if (!TEST_PAGE_ID || !TEST_SPACE_ID) {
    console.error('Set TEST_PAGE_ID and TEST_SPACE_ID environment variables');
    process.exit(1);
  }

  const client = new DocmostClient({
    baseUrl: process.env.DOCMOST_URL || 'http://localhost:3000',
    email: process.env.DOCMOST_EMAIL,
    password: process.env.DOCMOST_PASSWORD,
    debug: true,
  });

  console.log('=== Block Insert Test ===\n');

  // 1. Login
  console.log('1. Logging in...');
  await client.login();
  console.log('   Logged in successfully\n');

  // 2. Get current page content
  console.log('2. Getting current page content...');
  const currentContent = await client.getPageContent(TEST_PAGE_ID, TEST_SPACE_ID);
  console.log(`   Content type: ${typeof currentContent}`);
  console.log(`   Content.type: ${currentContent?.type}`);
  console.log(`   Content.content length: ${currentContent?.content?.length}`);
  console.log(`   Content nodes: ${JSON.stringify(currentContent?.content?.map((n: any) => n.type))}`);
  console.log(`   Full content: ${JSON.stringify(currentContent, null, 2).substring(0, 1000)}\n`);

  // 3. Build a fake drawio node (using a dummy attachment ID)
  console.log('3. Building test drawio node...');
  const testNode = buildDrawioNode(
    'test-attachment-id-123',
    '/api/files/test-attachment-id-123/test.drawio.svg',
    'test.drawio.svg',
    'center'
  );
  console.log(`   Node: ${JSON.stringify(testNode)}\n`);

  // 4. Test appendNodeToDocument
  console.log('4. Testing appendNodeToDocument...');
  const appendedContent = appendNodeToDocument(currentContent, testNode);
  console.log(`   Input nodes: ${currentContent?.content?.length || 0}`);
  console.log(`   Output nodes: ${appendedContent?.content?.length || 0}`);
  console.log(`   Output node types: ${JSON.stringify(appendedContent?.content?.map((n: any) => n.type))}`);

  if (appendedContent?.content?.length === (currentContent?.content?.length || 0) + 1) {
    console.log('   ✅ Append preserved existing content\n');
  } else {
    console.log('   ❌ Append did NOT preserve existing content!\n');
    console.log(`   Expected: ${(currentContent?.content?.length || 0) + 1} nodes`);
    console.log(`   Got: ${appendedContent?.content?.length || 0} nodes`);
  }

  // 5. Test prependNodeToDocument
  console.log('5. Testing prependNodeToDocument...');
  const prependedContent = prependNodeToDocument(currentContent, testNode);
  console.log(`   Input nodes: ${currentContent?.content?.length || 0}`);
  console.log(`   Output nodes: ${prependedContent?.content?.length || 0}`);
  console.log(`   Output node types: ${JSON.stringify(prependedContent?.content?.map((n: any) => n.type))}`);

  if (prependedContent?.content?.length === (currentContent?.content?.length || 0) + 1) {
    console.log('   ✅ Prepend preserved existing content\n');
  } else {
    console.log('   ❌ Prepend did NOT preserve existing content!\n');
  }

  console.log('=== Test Complete ===');
}

main().catch(console.error);
