import { supabase } from '@/integrations/supabase/client';

export interface AmexAccount {
  id: string;
  name: string;
  type: 'credit' | 'charge';
  balance: number;
  availableCredit?: number;
  lastUpdated: Date;
  provider: 'plaid' | 'direct' | 'manual';
  externalAccountId?: string;
}

export interface AmexTransaction {
  id: string;
  accountId: string;
  amount: number;
  description: string;
  date: Date;
  category?: string;
  merchant?: string;
}

class AmexService {
  // Plaid Integration Methods
  async connectViaPlaid(publicToken: string): Promise<AmexAccount[]> {
    try {
      // TODO: Exchange public token for access token via edge function
      const { data, error } = await supabase.functions.invoke('plaid-exchange-token', {
        body: { public_token: publicToken }
      });

      if (error) throw error;

      // Store accounts in database
      const accounts = await this.storeAccounts(data.accounts, 'plaid');
      return accounts;
    } catch (error) {
      console.error('Plaid connection failed:', error);
      throw new Error('Failed to connect Amex accounts via Plaid');
    }
  }

  async refreshPlaidAccounts(accessToken: string): Promise<AmexAccount[]> {
    try {
      const { data, error } = await supabase.functions.invoke('plaid-get-accounts', {
        body: { access_token: accessToken }
      });

      if (error) throw error;

      return this.updateAccountBalances(data.accounts);
    } catch (error) {
      console.error('Plaid refresh failed:', error);
      throw new Error('Failed to refresh account data');
    }
  }

  // Direct API Methods (Future Implementation)
  async connectViaDirect(credentials: { username: string; password: string }): Promise<AmexAccount[]> {
    // TODO: Implement direct Amex API connection when available
    throw new Error('Direct Amex API connection not yet available');
  }

  // Manual Entry Methods
  async addManualAccount(accountData: {
    name: string;
    type: 'credit' | 'charge';
    balance: number;
    availableCredit?: number;
  }): Promise<AmexAccount> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          name: accountData.name,
          type: accountData.type === 'credit' ? 'credit_card' : 'charge_card',
          current_balance: -Math.abs(accountData.balance), // Negative for liabilities
          is_asset: false, // Credit cards are liabilities
          provider: 'manual'
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        type: accountData.type,
        balance: accountData.balance,
        availableCredit: accountData.availableCredit,
        lastUpdated: new Date(data.updated_at),
        provider: 'manual'
      };
    } catch (error) {
      console.error('Manual account creation failed:', error);
      throw new Error('Failed to create manual account');
    }
  }

  async updateManualAccount(accountId: string, balance: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({
          current_balance: -Math.abs(balance), // Negative for liabilities
          last_updated: new Date().toISOString()
        })
        .eq('id', accountId);

      if (error) throw error;
    } catch (error) {
      console.error('Manual account update failed:', error);
      throw new Error('Failed to update account balance');
    }
  }

  // Common Account Management
  async getUserAccounts(): Promise<AmexAccount[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('type', ['credit_card', 'charge_card']);

      if (error) throw error;

      return data.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type === 'credit_card' ? 'credit' : 'charge',
        balance: Math.abs(account.current_balance), // Convert back to positive for display
        lastUpdated: new Date(account.updated_at),
        provider: (account.provider as 'plaid' | 'direct' | 'manual') || 'manual',
        externalAccountId: account.account_id
      }));
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
      throw new Error('Failed to retrieve accounts');
    }
  }

  async deleteAccount(accountId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_active: false })
        .eq('id', accountId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete account:', error);
      throw new Error('Failed to delete account');
    }
  }

  // Private helper methods
  private async storeAccounts(accounts: any[], provider: 'plaid' | 'direct'): Promise<AmexAccount[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const accountsToInsert = accounts
      .filter(account => account.subtype === 'credit card' || account.type === 'credit')
      .map(account => ({
        user_id: user.id,
        name: account.name,
        type: 'credit_card',
        current_balance: -Math.abs(account.balances.current), // Negative for liabilities
        is_asset: false,
        provider,
        account_id: account.account_id
      }));

    const { data, error } = await supabase
      .from('accounts')
      .insert(accountsToInsert)
      .select();

    if (error) throw error;

    return data.map(account => ({
      id: account.id,
      name: account.name,
      type: 'credit',
      balance: Math.abs(account.current_balance),
      lastUpdated: new Date(account.updated_at),
      provider,
      externalAccountId: account.account_id
    }));
  }

  private async updateAccountBalances(accounts: any[]): Promise<AmexAccount[]> {
    const updatePromises = accounts.map(account =>
      supabase
        .from('accounts')
        .update({
          current_balance: -Math.abs(account.balances.current),
          last_updated: new Date().toISOString()
        })
        .eq('account_id', account.account_id)
    );

    await Promise.all(updatePromises);
    return this.getUserAccounts();
  }
}

export const amexService = new AmexService();