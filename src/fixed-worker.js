// Modified Guestbook Worker with proper column support
// This adds support for:
// - Phone column (phone type)
// - Contact Preference column (select type)
// - Source column (select type)

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const allowedOrigins = [
      'https://cameronmurdock.github.io',
      'https://gen.gratis',
      'http://localhost:8000'
    ];
    
    const origin = request.headers.get('Origin') || '';
    const isAllowedOrigin = allowedOrigins.includes(origin) || origin.endsWith('.github.io');
    
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": isAllowedOrigin ? origin : allowedOrigins[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    
    // Only allow POST
    if (request.method !== 'POST') {
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
    
    // Parse the request body
    let body;
    try {
      body = await request.json();
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
    const { name, email, message, phone, contactPreference, source, eventId } = body;
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
    
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({
        error: "Invalid email format"
      }), { 
        status: 400, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
    }
    
    // Clean message text
    const cleanMessage = message.trim();
    
    // Prepare the Notion payload
    const notionPayload = {
      parent: { database_id: env.NOTION_DB },
      properties: {
        // Base required fields
        "Name": { title: [{ text: { content: name } }] },
        "Email": { email: email },
        "Message": { rich_text: [{ text: { content: cleanMessage } }] },
        
        // Optional fields with proper types
        "Membership Type": { multi_select: [{ name: "Guest" }] },
        "Guestbook Date": { date: { start: new Date().toISOString() } },
        
        // Add phone if provided (use phone type)
        ...(phone ? { "Phone": { phone: phone } } : {}),
        
        // Add contact preference if provided (use select type)
        ...(contactPreference ? { "Contact Preference": { 
          select: { name: contactPreference } 
        } } : {}),
        
        // Add source if provided (use select type)
        ...(source ? { "Source": { 
          select: { name: source } 
        } } : {}),
        
        // Add event relation if provided
        ...(eventId ? { "Events Attended": { 
          relation: [{ id: eventId }] 
        } } : {})
      }
    };
    
    // Call Notion API to create the page
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
      
      // Get response as text first (for debugging)
      const responseText = await notionRes.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }
      
      // If Notion request failed
      if (!notionRes.ok) {
        console.error("Notion API error:", responseData);
        
        let errorMessage = "Failed to submit to Notion.";
        if (notionRes.status === 404) {
          errorMessage = "Notion database not found. Please check the database ID and sharing settings.";
        } else if (notionRes.status === 401 || notionRes.status === 403) {
          errorMessage = "Authorization error with Notion API.";
        }
        
        return new Response(JSON.stringify({
          error: errorMessage,
          details: responseData
        }), { 
          status: 502, 
          headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
          } 
        });
      }
      
      // Success!
      return new Response(JSON.stringify({
        ok: true,
        message: "Guestbook submission successful!"
      }), { 
        status: 200, 
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS
        } 
      });
      
    } catch (error) {
      console.error("Unexpected error:", error);
      
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: "An unexpected error occurred"
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
