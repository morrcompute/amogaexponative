import { getSentEmails } from '@/lib/email/mail-service';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    const result = await getSentEmails({ page, limit });

    return Response.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        message: `API Error: ${error.message || error}`,
        emails: [],
      },
      { status: 500 }
    );
  }
}
