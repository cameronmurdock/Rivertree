export default {
  async fetch(req, env, ctx) {
    // CORS headers - Adjust Allow-Origin if needed, e.g., your GitHub Pages URL
    const CORS = {
      "Access-Control-Allow-Origin": "*", // Consider restricting this in production
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }

    // --- Optional: Rate Limiting --- 
    // Requires KV binding 'RATE_KV' in wrangler.toml and namespace creation
    // Remove or comment out this block if not using rate limiting
    if (env.RATE_KV) {
      try {
        const ip = req.headers.get("CF-Connecting-IP");
        if (ip) {
            const key = `ip:${ip}`;
            const currentHits = await env.RATE_KV.get(key, { type: 'text' });
            const hits = parseInt(currentHits || "0", 10);

            if (hits >= 30) { // Limit: 30 requests
                return new Response("Rate limit exceeded", { status: 429, headers: CORS });
            }
            
            // Increment count, expire after 10 minutes (600 seconds)
            // Use waitUntil to avoid blocking the response
            ctx.waitUntil(env.RATE_KV.put(key, (hits + 1).toString(), { expirationTtl: 600 })); 
        } else {
            console.warn("Could not determine client IP for rate limiting.");
            // Decide if you want to block or allow requests without IP
        }
      } catch (kvError) {
          console.error("KV Error for rate limiting:", kvError);
          // Decide if you want to block or allow if KV fails
      }
    }
    // --- End Optional: Rate Limiting ---

    let body;
    try {
      // Check content type strictly
      if (!req.headers.get("content-type")?.includes("application/json")) {
          return new Response("Expected 'application/json' Content-Type", { status: 415, headers: CORS });
      }
      body = await req.json();
    } catch (e) {
        console.error("Failed to parse JSON:", e);
        return new Response("Invalid JSON format", { status: 400, headers: CORS });
    }

    // Validate required fields
    const { name, email, message } = body;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response("Missing required fields: name, email, message", { status: 400, headers: CORS });
    }

    // Basic email format validation
    if (!/\S+@\S+\.\S+/.test(email)) {
        return new Response("Invalid email format", { status: 400, headers: CORS });
    }
    
    // --- Prepare Notion Payload --- 
    // Ensure these property names match your Notion database EXACTLY (case-sensitive)
    const notionPayload = {
      parent: { database_id: env.NOTION_DB }, // Secret from wrangler secret put NOTION_DB
      properties: {
        // Property named 'Name' of type 'Title'
        "Name":      { title:     [{ text: { content: name } }] }, 
        // Property named 'Email' of type 'Email'
        "Email":     { email: email }, 
        // Property named 'Message' of type 'Rich Text'
        "Message":   { rich_text: [{ text: { content: message } }] },
        
        // Add the fixed Membership Type
        // ASSUMPTION: Property named 'Membership Type' exists in Notion of type 'Select'
        // If it's a 'Text' type, use: { rich_text: [{ text: { content: "Guest" } }] }
        "Membership Type": { select: { name: "Guest" } },

        // Optional: Add a 'Timestamp' property (Type: Date) in Notion 
        // and uncomment below if you want the Worker to set it.
        // Otherwise, use Notion's built-in 'Created time' property.
        // "Timestamp": { date: { start: new Date().toISOString() } } 
      }
    };

    // --- Call Notion API --- 
    try {
      const notionRes = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.NOTION_SECRET}`, // Secret from wrangler secret put NOTION_SECRET
          "Notion-Version": env.NOTION_VERSION, // Variable from wrangler.toml
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(notionPayload)
      });

      if (!notionRes.ok) {
        // Log detailed error from Notion but return generic error to client
        const errorBody = await notionRes.text();
        console.error(`Notion API Error (${notionRes.status}): ${errorBody}`);
        let clientMessage = "Failed to submit to Notion due to upstream error.";
        if (notionRes.status === 400) {
            clientMessage = "Failed to submit: Check if Notion database properties match worker payload.";
        } else if (notionRes.status === 401 || notionRes.status === 403) {
            clientMessage = "Failed to submit: Notion authorization error. Check NOTION_SECRET.";
        } else if (notionRes.status === 404) {
            clientMessage = "Failed to submit: Notion database not found. Check NOTION_DB ID.";
        }
        return new Response(clientMessage, { status: 502, headers: CORS });
      }

      // --- Success --- 
      // Notion API call was successful
      const successData = await notionRes.json(); // Contains the created page object
      console.log("Successfully created Notion page:", successData.id);
      return new Response(JSON.stringify({ ok: true, message: "Submission received!" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS }
      });

    } catch (error) {
      console.error("Network or other error calling Notion API:", error);
      return new Response("Internal server error while contacting Notion", { status: 500, headers: CORS });
    }
  }
};
