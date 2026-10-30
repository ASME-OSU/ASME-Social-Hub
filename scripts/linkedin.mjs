import {safeJson} from './ig.mjs';

const retrySafe = message => Object.assign(new Error(message), {retrySafe: true});

/**
 * Creates a LinkedIn REST API client for publishing posts and images to an Organization Page.
 * Uses LinkedIn's versioned Community Management / Posts REST API (v202401+).
 */
export function createLinkedInClient({env = process.env, fetchImpl = fetch} = {}) {
  const version = env.LINKEDIN_API_VERSION || '202401';
  const base = 'https://api.linkedin.com/rest';

  const request = async (resource, {method = 'GET', headers = {}, body} = {}) => {
    if (!env.LINKEDIN_ACCESS_TOKEN) throw retrySafe('LinkedIn requires LINKEDIN_ACCESS_TOKEN');
    const url = new URL(resource.startsWith('http') ? resource : `${base}/${resource}`);
    const reqHeaders = {
      Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}`,
      'LinkedIn-Version': version,
      'X-Restli-Protocol-Version': '2.0.0',
      ...headers
    };
    if (body && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: reqHeaders,
        body: typeof body === 'object' && !(body instanceof Uint8Array || body instanceof ArrayBuffer)
          ? JSON.stringify(body)
          : body,
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw new Error('LinkedIn: network request failed; reconcile before retrying writes');
    }

    if (response.status === 201) {
      const id = response.headers.get('x-restli-id') || response.headers.get('x-linkedin-id');
      let data = {};
      try { data = await response.json(); } catch {}
      return { id: id || data.id, ...data };
    }

    return safeJson(response, 'LinkedIn');
  };

  const uploadImage = async (imageUrl, ownerUrn) => {
    // Step 1: Initialize image upload
    const initRes = await request('images?action=initializeUpload', {
      method: 'POST',
      body: {
        initializeUploadRequest: {
          owner: ownerUrn
        }
      }
    });

    const uploadUrl = initRes.value?.uploadUrl;
    const imageUrn = initRes.value?.image;
    if (!uploadUrl || !imageUrn) {
      throw retrySafe('LinkedIn image upload initialization failed');
    }

    // Step 2: Fetch flyer image binary from public URL
    let media;
    try {
      media = await fetchImpl(imageUrl, {signal: AbortSignal.timeout(30000)});
    } catch {
      throw retrySafe('LinkedIn flyer could not be fetched');
    }
    if (!media.ok) throw retrySafe(`LinkedIn flyer unreachable (HTTP ${media.status})`);
    const bytes = await media.arrayBuffer();
    const contentType = media.headers.get('content-type') || 'image/jpeg';

    // Step 3: Upload binary image to the designated uploadUrl
    let uploadRes;
    try {
      uploadRes = await fetchImpl(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType
        },
        body: bytes,
        signal: AbortSignal.timeout(30000)
      });
    } catch {
      throw retrySafe('LinkedIn binary image upload failed');
    }
    if (!uploadRes.ok) {
      throw retrySafe(`LinkedIn image upload failed (HTTP ${uploadRes.status})`);
    }

    return imageUrn;
  };

  const publishPost = async ({commentary, imageUrl, organizationId}) => {
    const orgId = organizationId || env.LINKEDIN_ORGANIZATION_ID;
    if (!orgId) throw retrySafe('LinkedIn requires LINKEDIN_ORGANIZATION_ID');
    const ownerUrn = String(orgId).startsWith('urn:li:') ? orgId : `urn:li:organization:${orgId}`;

    let mediaUrn;
    if (imageUrl) {
      mediaUrn = await uploadImage(imageUrl, ownerUrn);
    }

    const payload = {
      author: ownerUrn,
      commentary: commentary || '',
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false
    };

    if (mediaUrn) {
      payload.content = {
        media: {
          title: 'Event Flyer',
          id: mediaUrn
        }
      };
    }

    const res = await request('posts', {
      method: 'POST',
      body: payload
    });

    const postId = res.id;
    if (!postId) throw new Error('LinkedIn publish response missing ID; reconcile before retrying');

    const permalink = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`;
    return {
      postId: String(postId),
      permalink
    };
  };

  const verifyCredentials = async () => {
    const orgId = env.LINKEDIN_ORGANIZATION_ID;
    if (!orgId) throw retrySafe('Missing LINKEDIN_ORGANIZATION_ID');
    const rawId = String(orgId).replace(/^urn:li:organization:/, '');
    return request(`organizations/${encodeURIComponent(rawId)}`);
  };

  return {
    request,
    uploadImage,
    publishPost,
    verifyCredentials
  };
}
