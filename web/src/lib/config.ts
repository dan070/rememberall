// Same-origin by default: CloudFront proxies /api/* to the Lambda (see
// infra-stack.ts), so the deployed app just calls relative "/api/..."
// paths — no CORS preflight on the hot path. The raw Lambda Function URL
// requires AWS_IAM/SigV4, which only CloudFront's Origin Access Control
// can produce, so it's not directly callable.
//
// The relative path only resolves correctly when the page itself is
// served from that same CloudFront distribution. Running `vite dev`
// locally has no such origin, so set VITE_API_URL to the full CloudFront
// URL (e.g. in web/.env.local) to test the dev server against the live
// backend.
export const API_URL: string = import.meta.env.VITE_API_URL ?? "";
