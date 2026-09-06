import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fillTemplate, parseLabeledMarkdown, setLabeledField } from './partner.mjs';

describe('partner markdown', () => {
  it('parses labeled list fields', () => {
    const fields = parseLabeledMarkdown('- Partner ID: `abc`\n- Role: issuer\n');
    assert.equal(fields['Partner ID'], 'abc');
    assert.equal(fields.Role, 'issuer');
  });

  it('updates a labeled field in place', () => {
    const next = setLabeledField('- Partner ID: old\n- Role: issuer\n', 'Partner ID', 'new-id');
    assert.equal(parseLabeledMarkdown(next)['Partner ID'], 'new-id');
    assert.equal(parseLabeledMarkdown(next).Role, 'issuer');
  });

  it('fills template tokens', () => {
    assert.equal(fillTemplate('kid: {{kid}}', { kid: 'x' }), 'kid: x');
  });
});
