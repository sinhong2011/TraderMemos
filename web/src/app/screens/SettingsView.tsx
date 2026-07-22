import { Globe, Shield, Sparkles, Tag, Wallet } from "lucide-react";
import type { RiskRules } from "../../lib/api/settings";
import { useLocale } from "../../i18n";
import { useSettingsSection } from "../../lib/hooks/useSettingsSection";
import { settingsNavItems, settingsSectionCopy, type SettingsSectionId } from "../../lib/locale";
import type { Account, CashTransaction, Setup, Tag as TagType } from "../../lib/api/types";
import { AccountsTab, AiTab, GeneralTab, JournalTab, RulesTab } from "./settings/settings-sections";
import { SettingsNav, SettingsPageHeader, SettingsShell } from "./settings/settings-ui";
import { Page } from "../../components/Page";

export interface SettingsViewProps {
  accounts: Account[];
  accountsLoading: boolean;
  accountsError: boolean;
  onCreateAccount: (body: {
    name: string;
    broker: string;
    account_type: string;
    base_currency: string;
    starting_balance: number;
  }) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onClearAccountTrades: (id: string) => Promise<void>;

  cashTransactions: CashTransaction[];
  cashLoading: boolean;
  cashError: boolean;
  onCreateCash: (body: {
    account_id: string;
    type: string;
    amount: number;
    currency: string;
    occurred_at: string;
    note?: string;
  }) => Promise<void>;
  onDeleteCash: (id: string) => Promise<void>;

  tags: TagType[];
  tagsLoading: boolean;
  tagsError: boolean;
  onCreateTag: (body: { name: string; color?: string; kind?: string }) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;

  setups: Setup[];
  setupsLoading: boolean;
  setupsError: boolean;
  onCreateSetup: (name: string, description: string) => Promise<void>;
  onDeleteSetup: (id: string) => Promise<void>;

  riskRules?: RiskRules;
  riskRulesLoading: boolean;
  riskRulesError: boolean;
  riskRulesSaving: boolean;
  onSaveRiskRules: (body: RiskRules) => Promise<void>;

  checklistItems: string[];
  checklistLoading: boolean;
  checklistError: boolean;
  checklistSaving: boolean;
  onSaveChecklist: (items: string[]) => Promise<void>;
}

const NAV_ICONS: Record<SettingsSectionId, typeof Wallet> = {
  accounts: Wallet,
  rules: Shield,
  journal: Tag,
  ai: Sparkles,
  general: Globe,
};

export function SettingsView(props: SettingsViewProps) {
  const { locale } = useLocale();
  const [section, setSection] = useSettingsSection();
  const copy = settingsSectionCopy(locale, section);
  const navItems = settingsNavItems(locale).map((item) => ({
    ...item,
    icon: NAV_ICONS[item.id],
  }));

  return (
    <SettingsShell nav={<SettingsNav active={section} onChange={setSection} items={navItems} />}>
      <SettingsPageHeader title={copy.title} description={copy.description} />
      <Page className="gap-6 pt-1">
        {section === "accounts" && (
          <AccountsTab
            accounts={props.accounts}
            accountsLoading={props.accountsLoading}
            accountsError={props.accountsError}
            onCreateAccount={props.onCreateAccount}
            onDeleteAccount={props.onDeleteAccount}
            onClearAccountTrades={props.onClearAccountTrades}
            cashTransactions={props.cashTransactions}
            cashLoading={props.cashLoading}
            cashError={props.cashError}
            onCreateCash={props.onCreateCash}
            onDeleteCash={props.onDeleteCash}
          />
        )}
        {section === "rules" && (
          <RulesTab
            riskRules={props.riskRules}
            riskRulesLoading={props.riskRulesLoading}
            riskRulesError={props.riskRulesError}
            riskRulesSaving={props.riskRulesSaving}
            onSaveRiskRules={props.onSaveRiskRules}
            checklistItems={props.checklistItems}
            checklistLoading={props.checklistLoading}
            checklistError={props.checklistError}
            checklistSaving={props.checklistSaving}
            onSaveChecklist={props.onSaveChecklist}
          />
        )}
        {section === "journal" && (
          <JournalTab
            tags={props.tags}
            tagsLoading={props.tagsLoading}
            tagsError={props.tagsError}
            onCreateTag={props.onCreateTag}
            onDeleteTag={props.onDeleteTag}
            setups={props.setups}
            setupsLoading={props.setupsLoading}
            setupsError={props.setupsError}
            onCreateSetup={props.onCreateSetup}
            onDeleteSetup={props.onDeleteSetup}
          />
        )}
        {section === "ai" && <AiTab />}
        {section === "general" && <GeneralTab />}
      </Page>
    </SettingsShell>
  );
}
