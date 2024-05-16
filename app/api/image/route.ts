import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { increaseApiLimit, checkApiLimit } from '@/lib/api-limit';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {

        const { userId } = auth();
        const body = await request.json();
        const { prompt, amount=1, resolution="512x512" } = body;

        if (!userId) {
            return new NextResponse("OpenAI API Key not configured", { status: 500});
        }

        if (!prompt) {
            return new NextResponse("Prompt is required", { status : 400 });
        }

        if (!amount) {
            return new NextResponse("Amount is required", { status : 400 });
        }

        if (!resolution) {
            return new NextResponse("Resolution is required", { status : 400 });
        }

        const freeTrail = await checkApiLimit();

        if (!freeTrail) {
            return new NextResponse("Free trial has expired.", { status: 403 });
        }

        const response = await openai.images.generate({
            prompt,
            n: parseInt(amount, 10),
            size: resolution,
        });

        await increaseApiLimit();

        return NextResponse.json(response.data);
    } catch (error) {
        if (isOpenAIError(error)) {
            if (error.status === 429) {
                console.error('OpenAI API quota exceeded:', error);
                return NextResponse.json({ error: 'OpenAI API quota exceeded. Please check your plan and billing details.' }, { status: 429 });
            }
        }

        console.error('Error in API:', error);
        return NextResponse.json({ error: 'Failed to fetch completion' }, { status: 500 });
    }
}

function isOpenAIError(error: any): error is { status: number; response?: { status: number } } {
    return typeof error === 'object' && error !== null && 'status' in error;
}
