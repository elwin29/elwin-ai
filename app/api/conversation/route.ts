import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

import { increaseApiLimit, checkApiLimit } from '@/lib/api-limit';
import { auth } from '@clerk/nextjs/server';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { userId } = auth();
        const { messages } = await request.json();

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        if (!messages) {
            return new NextResponse("Messages are required", { status: 400 });
        }

        const freeTrail = await checkApiLimit();

        if (!freeTrail) {
            return new NextResponse("Free trial has expired.", { status: 403 });
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: messages,
        });

        await increaseApiLimit();

        return NextResponse.json(response.choices[0].message);
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
