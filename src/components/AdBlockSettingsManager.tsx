import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield, Save, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AdBlockRules {
  cssSelectors: string[];
  blockPopups: boolean;
  blockNewTabs: boolean;
}

const defaultRules: AdBlockRules = {
  cssSelectors: [
    '.ad', '.ads', '.advert', '.advertisement', '.ad-container', '.ad-wrapper',
    '.banner-ad', '.top-ad', '.bottom-ad', '.sidebar-ad',
    '.popup', '.popunder', '.overlay-ad', '.interstitial',
    '.sticky-ad', '.fixed-ad', '.floating-ad',
    '.modal-backdrop', '.modal-overlay'
  ],
  blockPopups: true,
  blockNewTabs: true
};

const AdBlockSettingsManager = () => {
  const { toast } = useToast();
  const [rules, setRules] = useState<AdBlockRules>(defaultRules);
  const [newSelector, setNewSelector] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('ad_block_rules')
        .single();

      if (error) throw error;

      if (data?.ad_block_rules) {
        const rulesData = data.ad_block_rules as unknown as AdBlockRules;
        if (rulesData.cssSelectors && typeof rulesData.blockPopups === 'boolean') {
          setRules(rulesData);
        }
      }
    } catch (error) {
      console.error('Error fetching ad-block rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveRules = async () => {
    setIsSaving(true);
    try {
      // Update both site_settings and site_settings_public
      const { error: privateError } = await supabase
        .from('site_settings')
        .update({ ad_block_rules: rules as any })
        .eq('id', (await supabase.from('site_settings').select('id').single()).data?.id);

      if (privateError) throw privateError;

      const { data: publicData } = await supabase
        .from('site_settings_public')
        .select('id')
        .single();

      if (publicData) {
        await supabase
          .from('site_settings_public')
          .update({ ad_block_rules: rules as any })
          .eq('id', publicData.id);
      }

      toast({
        title: 'Ad-block rules saved',
        description: 'Your ad-block settings have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving rules',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addSelector = () => {
    const trimmed = newSelector.trim();
    if (!trimmed) return;
    
    if (rules.cssSelectors.includes(trimmed)) {
      toast({
        title: 'Selector already exists',
        description: 'This CSS selector is already in the list.',
        variant: 'destructive',
      });
      return;
    }

    setRules(prev => ({
      ...prev,
      cssSelectors: [...prev.cssSelectors, trimmed]
    }));
    setNewSelector('');
  };

  const removeSelector = (selector: string) => {
    setRules(prev => ({
      ...prev,
      cssSelectors: prev.cssSelectors.filter(s => s !== selector)
    }));
  };

  const resetToDefaults = () => {
    setRules(defaultRules);
    toast({
      title: 'Reset to defaults',
      description: 'Ad-block rules have been reset to default values. Save to apply.',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Ad-Block Rules
        </CardTitle>
        <CardDescription>
          Configure CSS selectors and behaviors for blocking ads in iframe streams.
          These rules are applied when ad-block is enabled on a streaming server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Behavior Toggles */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Blocking Behaviors</h4>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Block Popups</Label>
              <p className="text-sm text-muted-foreground">
                Prevent window.open() calls from opening popup windows
              </p>
            </div>
            <Switch
              checked={rules.blockPopups}
              onCheckedChange={(checked) => setRules(prev => ({ ...prev, blockPopups: checked }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Block New Tabs</Label>
              <p className="text-sm text-muted-foreground">
                Prevent scripts from opening new browser tabs
              </p>
            </div>
            <Switch
              checked={rules.blockNewTabs}
              onCheckedChange={(checked) => setRules(prev => ({ ...prev, blockNewTabs: checked }))}
            />
          </div>
        </div>

        {/* CSS Selectors */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">CSS Selectors to Hide</h4>
          <p className="text-sm text-muted-foreground">
            Elements matching these CSS selectors will be hidden from the stream page.
          </p>
          
          {/* Add new selector */}
          <div className="flex gap-2">
            <Input
              value={newSelector}
              onChange={(e) => setNewSelector(e.target.value)}
              placeholder="e.g., .ad-banner, #popup-container, [data-ad]"
              onKeyDown={(e) => e.key === 'Enter' && addSelector()}
            />
            <Button onClick={addSelector} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {/* Selector list */}
          <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto p-2 bg-muted/30 rounded-md">
            {rules.cssSelectors.map((selector) => (
              <Badge
                key={selector}
                variant="secondary"
                className="flex items-center gap-1 py-1 px-2"
              >
                <code className="text-xs">{selector}</code>
                <button
                  onClick={() => removeSelector(selector)}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {rules.cssSelectors.length === 0 && (
              <p className="text-sm text-muted-foreground w-full text-center py-4">
                No selectors configured. Add some to block ad elements.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Total selectors: {rules.cssSelectors.length}
          </p>
        </div>

        {/* Bulk Edit */}
        <div className="space-y-2">
          <Label>Bulk Edit Selectors</Label>
          <Textarea
            value={rules.cssSelectors.join('\n')}
            onChange={(e) => {
              const selectors = e.target.value
                .split('\n')
                .map(s => s.trim())
                .filter(s => s.length > 0);
              setRules(prev => ({ ...prev, cssSelectors: selectors }));
            }}
            placeholder="One selector per line"
            rows={6}
            className="font-mono text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveRules} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Rules'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdBlockSettingsManager;
