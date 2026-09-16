import { testSmtpConnection } from '@/lib/email/mail-service';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await testSmtpConnection(body.customConfig);

    return Response.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error: any) {
    return Response.json(
      {
        success: false,
        message: `SMTP Test Error: ${error.message || error}`,
      },
      { status: 500 }
    );
  }
}
