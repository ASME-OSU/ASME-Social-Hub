import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkedInClient} from '../scripts/linkedin.mjs';

test('createLinkedInClient requires LINKEDIN_ACCESS_TOKEN', async () => {
  const client = createLinkedInClient({env: {}});
  await assert.rejects(
    () => client.publishPost({commentary: 'Test post', organizationId: '123456'}),
    err => {
      assert.match(err.message, /LINKEDIN_ACCESS_TOKEN/);
      assert.equal(err.retrySafe, true);
      return true;
    }
  );
});

test('publishPost requires LINKEDIN_ORGANIZATION_ID if not passed in call', async () => {
  const client = createLinkedInClient({env: {LINKEDIN_ACCESS_TOKEN: 'test-token'}});
  await assert.rejects(
    () => client.publishPost({commentary: 'Test post'}),
    err => {
      assert.match(err.message, /LINKEDIN_ORGANIZATION_ID/);
      assert.equal(err.retrySafe, true);
      return true;
    }
  );
});

test('publishPost publishes a text-only post successfully', async () => {
  let capturedUrl, capturedOptions;
  const mockFetch = async (url, options) => {
    capturedUrl = String(url);
    capturedOptions = options;
    return new Response(JSON.stringify({id: 'urn:li:share:987654321'}), {
      status: 201,
      headers: {'Content-Type': 'application/json', 'x-restli-id': 'urn:li:share:987654321'}
    });
  };

  const client = createLinkedInClient({
    env: {LINKEDIN_ACCESS_TOKEN: 'li-token', LINKEDIN_ORGANIZATION_ID: '998877'},
    fetchImpl: mockFetch
  });

  const result = await client.publishPost({commentary: 'Exciting chapter announcement!'});
  assert.equal(result.postId, 'urn:li:share:987654321');
  assert.equal(result.permalink, 'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A987654321');

  assert.equal(capturedUrl, 'https://api.linkedin.com/rest/posts');
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.headers['Authorization'], 'Bearer li-token');
  assert.equal(capturedOptions.headers['LinkedIn-Version'], '202401');

  const body = JSON.parse(capturedOptions.body);
  assert.equal(body.author, 'urn:li:organization:998877');
  assert.equal(body.commentary, 'Exciting chapter announcement!');
  assert.equal(body.visibility, 'PUBLIC');
  assert.equal(body.lifecycleState, 'PUBLISHED');
  assert.equal(body.content, undefined);
});

test('publishPost uploads flyer image and attaches media URN', async () => {
  const calls = [];
  const mockFetch = async (url, options = {}) => {
    const urlStr = String(url);
    calls.push({url: urlStr, method: options.method || 'GET', headers: options.headers});

    if (urlStr === 'https://api.linkedin.com/rest/images?action=initializeUpload') {
      return new Response(
        JSON.stringify({
          value: {
            uploadUrl: 'https://media.licdn.com/upload/target123',
            image: 'urn:li:image:D4E10AQFtest'
          }
        }),
        {status: 200, headers: {'Content-Type': 'application/json'}}
      );
    }

    if (urlStr === 'https://example.org/flyer.jpg') {
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), {
        status: 200,
        headers: {'Content-Type': 'image/jpeg'}
      });
    }

    if (urlStr === 'https://media.licdn.com/upload/target123') {
      return new Response(null, {status: 201});
    }

    if (urlStr === 'https://api.linkedin.com/rest/posts') {
      return new Response(JSON.stringify({id: 'urn:li:share:555444333'}), {
        status: 201,
        headers: {'Content-Type': 'application/json', 'x-restli-id': 'urn:li:share:555444333'}
      });
    }

    throw new Error(`Unexpected mock URL: ${urlStr}`);
  };

  const client = createLinkedInClient({
    env: {LINKEDIN_ACCESS_TOKEN: 'li-token', LINKEDIN_ORGANIZATION_ID: 'urn:li:organization:12345'},
    fetchImpl: mockFetch
  });

  const result = await client.publishPost({
    commentary: 'Join us tonight!',
    imageUrl: 'https://example.org/flyer.jpg'
  });

  assert.equal(result.postId, 'urn:li:share:555444333');
  assert.equal(calls.length, 4);

  // Call 1: initializeUpload
  assert.equal(calls[0].method, 'POST');
  assert.match(calls[0].url, /images\?action=initializeUpload/);

  // Call 2: fetch flyer
  assert.equal(calls[1].method, 'GET');
  assert.equal(calls[1].url, 'https://example.org/flyer.jpg');

  // Call 3: upload binary
  assert.equal(calls[2].method, 'PUT');
  assert.equal(calls[2].url, 'https://media.licdn.com/upload/target123');

  // Call 4: create post
  assert.equal(calls[3].method, 'POST');
  assert.match(calls[3].url, /posts/);
});

test('verifyCredentials queries organization endpoint', async () => {
  let requestedUrl;
  const mockFetch = async url => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({id: 12345, localizedName: 'ASME OSU'}), {
      status: 200,
      headers: {'Content-Type': 'application/json'}
    });
  };

  const client = createLinkedInClient({
    env: {LINKEDIN_ACCESS_TOKEN: 'valid-token', LINKEDIN_ORGANIZATION_ID: '12345'},
    fetchImpl: mockFetch
  });

  const org = await client.verifyCredentials();
  assert.equal(org.id, 12345);
  assert.equal(requestedUrl, 'https://api.linkedin.com/rest/organizations/12345');
});

test('network failure throws error requiring reconciliation', async () => {
  const client = createLinkedInClient({
    env: {LINKEDIN_ACCESS_TOKEN: 'token', LINKEDIN_ORGANIZATION_ID: '123'},
    fetchImpl: async () => {
      throw new Error('Connection reset');
    }
  });

  await assert.rejects(
    () => client.publishPost({commentary: 'Hello'}),
    /reconcile before retrying writes/
  );
});
