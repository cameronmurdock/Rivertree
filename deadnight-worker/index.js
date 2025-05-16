// Dead Night Event Guestbook Worker
// Specific worker for the Dead Night 5/16/25 event

export default {
  async fetch(req, env, ctx) {
    // CORS headers for allowed origins
    const allowedOrigins = [
      'https://cameronmurdock.github.io',
      'https://gen.gratis',
      'http://localhost:8000'  // For local testing
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
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({
        error: "Method Not Allowed",
        allowed: ["POST", "OPTIONS"]
      }), { 
        status: 405, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
    }

    // Parse and validate the request body
    let body;
    try {
      const contentType = req.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        return new Response(JSON.stringify({
          error: "Unsupported Media Type",
          message: "Expected 'application/json' Content-Type"
        }), { 
          status: 415, 
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
          } 
        });
      }
      
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({
        error: "Invalid JSON",
        message: "Failed to parse request body as JSON"
      }), { 
        status: 400, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
    }

    // Validate required fields
    const { name, email, message } = body;
    const missingFields = [];
    if (!name?.trim()) missingFields.push('name');
    if (!email?.trim()) missingFields.push('email');
    if (!message?.trim()) missingFields.push('message');
    
    if (missingFields.length > 0) {
      return new Response(JSON.stringify({
        error: "Missing required fields",
        missing: missingFields
      }), { 
        status: 400, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
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
    }
    
    // Event info hardcoded for Dead Night
    const eventName = "Dead Night 5/16/25";
    const eventId = "dead-night-051625";
    
    // Prepare Notion payload
    const notionPayload = {
      parent: { database_id: env.NOTION_DB },
      properties: {
        "Name": { title: [{ text: { content: name } }] }, 
        "Email": { email: email }, 
        "Message": { rich_text: [{ text: { content: message } }] },
        "Membership Type": { multi_select: [{ name: "Guest" }] },
        "Guestbook Date": { date: { start: new Date().toISOString() } },
        "Event": { rich_text: [{ text: { content: eventName } }] }
      }
    };

    // Call Notion API
    try {
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

      // Process response
      const responseText = await notionRes.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }

      if (!notionRes.ok) {
        let clientMessage = "Failed to submit to Notion due to an error.";
        
        if (notionRes.status === 400) {
          clientMessage = "Failed to submit: Notion database format mismatch.";
        } else if (notionRes.status === 401 || notionRes.status === 403) {
          clientMessage = "Failed to submit: Authorization error.";
        } else if (notionRes.status === 404) {
          clientMessage = "Failed to submit: Database not found.";
        } else if (notionRes.status >= 500) {
          clientMessage = "Notion API is currently unavailable.";
        }
        
        return new Response(JSON.stringify({
          error: clientMessage,
          details: responseData
        }), { 
          status: 502, 
          headers: { 
            'Content-Type': 'application/json',
            ...CORS_HEADERS 
          } 
        });
      }
      
      // Success response
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Thanks for signing up for Dead Night!"
      }), { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          ...CORS_HEADERS 
        } 
      });
    } catch (error) {
      // Handle unexpected errors
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Internal server error",
        message: "An unexpected error occurred while processing your request."
      }), { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          ...CORS_HEADERS 
        } 
      });
    }
  }
};
