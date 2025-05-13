// Simple in-memory log store for debugging
const requestLogs = [];

// Maximum number of logs to keep
const MAX_LOGS = 50;

function addLog(log) {
  requestLogs.unshift({
    timestamp: new Date().toISOString(),
    ...log
  });
  // Keep only the most recent logs
  if (requestLogs.length > MAX_LOGS) {
    requestLogs.length = MAX_LOGS;
  }
}

export default {
  async fetch(req, env, ctx) {
    // Add request to logs
    const requestId = crypto.randomUUID();
    const url = new URL(req.url);
    const requestDetails = {
      id: requestId,
      method: req.method,
      path: url.pathname,
      headers: Object.fromEntries(req.headers.entries())
    };
    
    addLog({
      type: 'request_start',
      ...requestDetails
    });
    
    // --- GET /shift-tasks: Fetch all tasks for a given shift ---
    if (url.pathname === '/shift-tasks' && req.method === 'GET') {
      const shiftId = url.searchParams.get('shift');
      if (!shiftId) {
        return new Response(JSON.stringify({ error: 'Missing shift parameter' }), {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
      try {
        // Replace with your Completed Tasks Notion DB ID
        const completedTasksDbId = '1aa1503617b480e99f58f1de62991454';
        const notionRes = await fetch(`https://api.notion.com/v1/databases/${completedTasksDbId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.NOTION_SECRET}`,
            'Notion-Version': env.NOTION_VERSION || '2022-06-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            page_size: 100,
            filter: {
              property: 'Shifts',
              relation: { contains: shiftId }
            }
          })
        });
        const data = await notionRes.json();
        if (!notionRes.ok) {
          return new Response(JSON.stringify({ error: 'Failed to fetch tasks', details: data }), {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
          });
        }
        // Map to task info
        const tasks = (data.results || []).map(page => ({
          id: page.id,
          name: page.properties.Name?.title?.[0]?.plain_text || '(Untitled)',
          points: page.properties.Points?.number || 0,
          person: page.properties.Person?.rich_text?.[0]?.plain_text || '',
          completed: !!page.properties['Approve QA']?.checkbox // or use another property if needed
        }));
        return new Response(JSON.stringify({ tasks }), {
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Error fetching tasks', details: err.message }), {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
    }

    // --- POST /task-complete: Mark a task as complete/incomplete ---
    if (url.pathname === '/task-complete' && req.method === 'POST') {
      let body;
      try {
        body = await req.json();
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON', details: e.message }), {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
      const { taskId, completed } = body;
      if (!taskId || typeof completed !== 'boolean') {
        return new Response(JSON.stringify({ error: 'Missing or invalid taskId/completed' }), {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
      try {
        const notionRes = await fetch(`https://api.notion.com/v1/pages/${taskId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${env.NOTION_SECRET}`,
            'Notion-Version': env.NOTION_VERSION || '2022-06-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              'Approve QA': { checkbox: completed }
            }
          })
        });
        const data = await notionRes.json();
        if (!notionRes.ok) {
          return new Response(JSON.stringify({ error: 'Failed to update task', details: data }), {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Error updating task', details: err.message }), {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
    }

    // --- GET /projects: Fetch list of events/projects for dropdown ---
    if (url.pathname === '/projects' && req.method === 'GET') {
      try {
        const notionRes = await fetch('https://api.notion.com/v1/databases/1aa1503617b48028b0acce3076a49257/query', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.NOTION_SECRET}`,
            'Notion-Version': env.NOTION_VERSION || '2022-06-28',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ page_size: 100 })
        });
        const data = await notionRes.json();
        if (!notionRes.ok) {
          return new Response(JSON.stringify({ error: 'Failed to fetch projects', details: data }), {
            status: 500,
            headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
          });
        }
        // Map to id and name (assume title property is 'Name')
        const projects = (data.results || []).map(page => ({
          id: page.id,
          name: page.properties.Name?.title?.[0]?.plain_text || '(Untitled)'
        }));
        return new Response(JSON.stringify({ projects }), {
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Error fetching projects', details: err.message }), {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
        });
      }
    }

    // Special endpoint for viewing logs (allow GET and POST, check first)
    if (url.pathname === '/debug/logs' && (req.method === 'GET' || req.method === 'POST')) {
      const response = new Response(JSON.stringify({
        logs: requestLogs,
        timestamp: new Date().toISOString()
      }, null, 2), {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
      
      addLog({
        type: 'response',
        requestId,
        status: 200,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      return response;
    }
    // CORS headers
    const allowedOrigins = [
      'https://cameronmurdock.github.io',
      'https://gen.gratis',
      'http://localhost:8000'  // For local development
    ];
    
    const origin = req.headers.get('Origin') || '';
    const isAllowedOrigin = allowedOrigins.includes(origin) || origin.endsWith('.github.io');
    
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": isAllowedOrigin ? origin : allowedOrigins[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      const response = new Response(null, { 
        status: 204, 
        headers: CORS_HEADERS 
      });
      
      addLog({
        type: 'preflight',
        requestId,
        headers: CORS_HEADERS
      });
      
      return response;
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      const response = new Response(JSON.stringify({
        error: "Method Not Allowed",
        allowed: ["POST", "OPTIONS"]
      }), { 
        status: 405, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
      
      addLog({
        type: 'error',
        requestId,
        status: 405,
        error: 'Method Not Allowed'
      });
      
      return response;
    }

    // Rate Limiting (optional - requires KV binding 'RATE_KV' in wrangler.toml)
    if (env.RATE_KV) {
      try {
        const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
        const key = `rate_limit:${ip}`;
        const { value } = await env.RATE_KV.getWithMetadata(key, { type: 'json' });
        const now = Math.floor(Date.now() / 1000);
        const window = 60; // 1 minute window in seconds
        
        if (value) {
          const timePassed = now - value.timestamp;
          const newCount = Math.max(0, value.count - Math.floor(timePassed / 60)) + 1;
          
          if (newCount > 30) { // 30 requests per minute
            const response = new Response(JSON.stringify({
              error: "Rate limit exceeded",
              message: "Please try again later",
              retryAfter: 60
            }), { 
              status: 429, 
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60',
                ...CORS_HEADERS
              } 
            });
            
            addLog({
              type: 'rate_limit',
              requestId,
              status: 429,
              ip,
              count: newCount,
              maxRequests: 30,
              window: '1m'
            });
            
            return response;
          }
          
          await env.RATE_KV.put(key, JSON.stringify({
            count: newCount,
            timestamp: now
          }), { expirationTtl: window });
        } else {
          await env.RATE_KV.put(key, JSON.stringify({
            count: 1,
            timestamp: now
          }), { expirationTtl: window });
        }
      } catch (error) {
        console.error('Rate limiting error:', error);
        addLog({
          type: 'rate_limit_error',
          requestId,
          error: error.message
        });
        // Continue with the request if rate limiting fails
      }
    }

    // --- Parse and Validate Request ---
    let body;
    try {
      // Check content type strictly
      const contentType = req.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        const response = new Response(JSON.stringify({
          error: "Unsupported Media Type",
          message: "Expected 'application/json' Content-Type",
          received: contentType || 'none'
        }), { 
          status: 415, 
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
          } 
        });
        
        addLog({
          type: 'invalid_content_type',
          requestId,
          status: 415,
          contentType: contentType || 'none'
        });
        
        return response;
      }
      
      body = await req.json();
      
      addLog({
        type: 'request_parsed',
        requestId,
        body: {
          ...body,
          message: body.message ? body.message.substring(0, 100) + (body.message.length > 100 ? '...' : '') : ''
        }
      });
    } catch (e) {
      const response = new Response(JSON.stringify({
        error: "Invalid JSON",
        message: "Failed to parse request body as JSON",
        details: e.message
      }), { 
        status: 400, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
      
      addLog({
        type: 'parse_error',
        requestId,
        status: 400,
        error: e.message
      });
      
      return response;
    }

    // Validate required fields
    const { name, email, message, eventId } = body;
    const missingFields = [];
    if (!name?.trim()) missingFields.push('name');
    if (!email?.trim()) missingFields.push('email');
    if (!message?.trim()) missingFields.push('message');
    
    if (missingFields.length > 0) {
      const response = new Response(JSON.stringify({
        error: "Missing required fields",
        missing: missingFields,
        message: `The following fields are required: ${missingFields.join(', ')}`
      }), { 
        status: 400, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
      
      addLog({
        type: 'validation_error',
        requestId,
        status: 400,
        missingFields
      });
      
      return response;
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const response = new Response(JSON.stringify({
        error: "Validation Error",
        field: "email",
        message: "Invalid email format"
      }), { 
        status: 400, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
      
      addLog({
        type: 'validation_error',
        requestId,
        status: 400,
        field: 'email',
        error: 'Invalid email format'
      });
      
      return response;
    }
    
    // --- Prepare Notion Payload --- 
    // Ensure these property names match your Notion database EXACTLY (case-sensitive)
    const notionPayload = {
      parent: { database_id: env.NOTION_DB }, // Secret from wrangler secret
      properties: {
        // Property named 'Name' of type 'Title'
        "Name":      { title:     [{ text: { content: name } }] }, 
        // Property named 'Email' of type 'Email'
        "Email":     { email: email }, 
        // Property named 'Message' of type 'Rich Text'
        "Message":   { rich_text: [{ text: { content: message } }] },
        // Add the fixed Membership Type
        "Membership Type": { multi_select: [{ name: "Guest" }] },
        // Optional: Add a 'Timestamp' property (Type: Date) in Notion 
        "Guestbook Date": { date: { start: new Date().toISOString() } },
        // --- New: Relate guest to selected event/project ---
        ...(eventId ? { "Events Attended": { relation: [{ id: eventId }] } } : {})
      }
    };

    addLog({
      type: 'notion_payload',
      requestId,
      payload: {
        ...notionPayload,
        parent: { database_id: '...' + (env.NOTION_DB || '').slice(-4) }
      }
    });

    // --- Call Notion API --- 
    try {
      addLog({
        type: 'notion_request',
        requestId,
        url: 'https://api.notion.com/v1/pages',
        method: 'POST',
        headers: {
          'Notion-Version': env.NOTION_VERSION || '2022-06-28',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + (env.NOTION_SECRET ? '***' + env.NOTION_SECRET.slice(-4) : 'NOT_SET')
        }
      });
      
      const notionRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.NOTION_SECRET}`,
          "Notion-Version": env.NOTION_VERSION || "2022-06-28",
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(notionPayload)
      });

      const responseData = await notionRes.text();
      const notionResponse = responseData ? JSON.parse(responseData) : {};
      
      addLog({
        type: 'notion_response',
        requestId,
        status: notionRes.status,
        statusText: notionRes.statusText,
        response: notionRes.ok ? 
          { id: notionResponse.id || 'unknown' } : 
          notionResponse
      });
      
      if (!notionRes.ok) {
        let clientMessage = "Failed to submit to Notion due to an error.";
        let errorDetails = {};
        
        try {
          errorDetails = responseData ? JSON.parse(responseData) : {};
          
          if (notionRes.status === 400) {
            clientMessage = "Failed to submit: Check if Notion database properties match the expected format.";
          } else if (notionRes.status === 401 || notionRes.status === 403) {
            clientMessage = "Failed to submit: Notion authorization error. Please check your integration settings.";
          } else if (notionRes.status === 404) {
            clientMessage = "Failed to submit: Notion database not found. Please check the database ID and sharing settings.";
          } else if (notionRes.status >= 500) {
            clientMessage = "Notion API is currently unavailable. Please try again later.";
          }
        } catch (parseError) {
          console.error('Error parsing Notion error response:', parseError);
        }
        
        const response = new Response(JSON.stringify({
          error: clientMessage,
          status: notionRes.status,
          statusText: notionRes.statusText,
          details: errorDetails
        }), { 
          status: 502, 
          headers: { 
            'Content-Type': 'application/json',
            ...CORS_HEADERS 
          } 
        });
        
        addLog({
          type: 'notion_error',
          requestId,
          status: notionRes.status,
          error: clientMessage,
          details: errorDetails
        });
        
        return response;
      }
      
      // --- Success ---
      const successResponse = new Response(
        JSON.stringify({ 
          success: true, 
          message: "Guestbook entry submitted successfully!"
        }),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            ...CORS_HEADERS 
          } 
        }
      );
      
      addLog({
        type: 'success',
        requestId,
        status: 200,
        message: 'Guestbook entry submitted successfully',
        notionPageId: notionResponse.id || 'unknown'
      });
      
      return successResponse;
    } catch (error) {
      console.error('Error in worker:', error);
      
      const errorResponse = new Response(
        JSON.stringify({ 
          success: false, 
          error: "Internal server error",
          message: "An unexpected error occurred while processing your request.",
          details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...CORS_HEADERS 
          } 
        }
      );
      
      addLog({
        type: 'server_error',
        requestId,
        status: 500,
        error: error.message,
        stack: error.stack
      });
      
      return errorResponse;
    }
  },

  // Add a scheduled event handler (required by the Cloudflare Workers interface)
  async scheduled(event, env, ctx) {
    // This is a required method but we don't need it for this worker
    return new Response('Method not implemented', { status: 501 });
  }
};

