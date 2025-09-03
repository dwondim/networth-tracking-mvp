import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { public_token } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const plaidClientId = Deno.env.get('PLAID_CLIENT_ID')
    const plaidSecret = Deno.env.get('PLAID_SECRET')
    const plaidEnv = Deno.env.get('PLAID_ENV') || 'sandbox'

    if (!plaidClientId || !plaidSecret) {
      return new Response(
        JSON.stringify({ error: 'Plaid configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const plaidUrl = plaidEnv === 'production' 
      ? 'https://production.plaid.com' 
      : plaidEnv === 'development'
      ? 'https://development.plaid.com'
      : 'https://sandbox.plaid.com'

    // Exchange public token for access token
    const exchangeResponse = await fetch(`${plaidUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        public_token
      })
    })

    const exchangeData = await exchangeResponse.json()
    
    if (!exchangeResponse.ok) {
      throw new Error(exchangeData.error_message || 'Failed to exchange token')
    }

    // Get accounts
    const accountsResponse = await fetch(`${plaidUrl}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: plaidClientId,
        secret: plaidSecret,
        access_token: exchangeData.access_token
      })
    })

    const accountsData = await accountsResponse.json()
    
    if (!accountsResponse.ok) {
      throw new Error(accountsData.error_message || 'Failed to fetch accounts')
    }

    // Filter for Amex accounts and store in database
    const amexAccounts = accountsData.accounts.filter((account: any) => 
      account.institution_id === 'ins_3' && account.type === 'credit'
    )

    const accountsToStore = amexAccounts.map((account: any) => ({
      user_id: user.id,
      name: account.name,
      type: 'credit_card',
      current_balance: -Math.abs(account.balances.current || 0), // Credit cards are liabilities
      is_asset: false,
      provider: 'plaid',
      account_id: account.account_id
    }))

    if (accountsToStore.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('accounts')
        .insert(accountsToStore)

      if (insertError) {
        throw new Error(`Failed to store accounts: ${insertError.message}`)
      }
    }

    return new Response(
      JSON.stringify({ 
        accounts: amexAccounts.length,
        message: `Successfully connected ${amexAccounts.length} Amex accounts`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error exchanging Plaid token:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})