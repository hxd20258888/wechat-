import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveAvatarForDisplay } from './profile';

test('converts cloud avatar file id to a temporary display url', async () => {
  const result = await resolveAvatarForDisplay('cloud://avatar-file-id', async (fileID) => {
    assert.equal(fileID, 'cloud://avatar-file-id');
    return 'https://temp.example/avatar.png';
  });

  assert.equal(result, 'https://temp.example/avatar.png');
});

test('keeps normal image urls unchanged', async () => {
  const result = await resolveAvatarForDisplay('https://example.com/avatar.png', async () => {
    throw new Error('should not request temp url for normal urls');
  });

  assert.equal(result, 'https://example.com/avatar.png');
});
