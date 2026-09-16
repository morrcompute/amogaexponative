import { sendEmail } from '@/lib/email/mail-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await sendEmail(body);

    return Response.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        message: `API Error: ${error.message || error}`,
      },
      { status: 500 }
    );
  }
}
