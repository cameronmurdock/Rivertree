// Proxy router for Dead Night worker
// This acts as a middleware to route guestbook submissions
// to the working guestbook worker while preserving fields

export async function handleProxyFields(req, env, ctx) {
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
  
  try {
    // Parse the request body
    const body = await req.json();
    
    // Extract fields
    const { name, email, message, phone, contactPreference } = body;
    
    // Create enhanced message that includes all meta fields
    const enhancedMessage = `${message.trim()}
    
-------- FORM DETAILS --------
Phone: ${phone || "Not provided"}
Contact Preference: ${contactPreference || "None selected"}
Source: Guestbook
Event: Dead Night 5/16/25`;
    
    // Create the payload for the original worker
    const originalWorkerPayload = {
      name,
      email,
      message: enhancedMessage
    };
    
    console.log('Proxying to original worker with payload:', JSON.stringify(originalWorkerPayload));
    
    // Forward to the original worker that we know has working auth
    const originalWorkerUrl = 'https://guestbook-worker.riversideguestbook.workers.dev';
    
    const proxyResponse = await fetch(originalWorkerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(originalWorkerPayload)
    });
    
    // Get the response
    const responseData = await proxyResponse.text();
    
    // Return response from original worker
    return new Response(responseData, {
      status: proxyResponse.status,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Proxy error',
      message: 'Failed to proxy request to original worker'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...CORS_HEADERS
      }
    });
  }
}
