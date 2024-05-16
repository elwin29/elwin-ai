import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Replicate from "replicate"
import { increaseApiLimit, checkApiLimit } from '@/lib/api-limit';

const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN!
});

export async function POST(request: NextRequest) {
    try {
        const { userId } = auth();
        const { prompt } = await request.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!prompt) {
            return new NextResponse("Prompt is required", { status: 400 })
        }

        const freeTrail = await checkApiLimit();

        if (!freeTrail) {
            return new NextResponse("Free trial has expired.", { status: 403 });
        }

        const response = await replicate.run(
            "anotherjesse/zeroscope-v2-xl:9f747673945c62801b13b84701c783929c0ee784e4748ec062204894dda1a351", 
            { 
                input: {
                    prompt
                }
            }
        );

        await increaseApiLimit();
        return NextResponse.json(response);
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
