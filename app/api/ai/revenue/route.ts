import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt, hotelId } = await request.json()

    if (!prompt || !hotelId) {
      return NextResponse.json({ error: 'Missing prompt or hotelId' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set')
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    })

    const responseText = await response.text()
    console.log('Anthropic status:', response.status)
    console.log('Anthropic response:', responseText.slice(0, 500))

    if (!response.ok) {
      return NextResponse.json({ error: `Anthropic error: ${responseText}` }, { status: 500 })
    }

    const data = JSON.parse(responseText)
    const text = data.content?.[0]?.text ?? ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('No JSON found in:', text.slice(0, 300))
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const suggestions = JSON.parse(jsonMatch[0])
    return NextResponse.json({ suggestions })

  } catch (error) {
    console.error('Revenue AI error:', String(error))
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
