import {
  Globe,
  Github,
  Keyboard,
  KeyRound,
  Shield,
  Sparkles,
  Tag,
  UserRound,
  Wallet,
} from "lucide-react";
import type { AnnualGoal, RiskRules } from "@/lib/api/settings";
import { useLocale } from "@/i18n";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { settingsNavItems, settingsSectionCopy, type SettingsSectionId } from "@/lib/locale";
import type { Account, CashTransaction, Tag as TagType } from "@/lib/api/types";
import { AboutTab } from "./settings/about-tab";
import { AccountTab } from "./settings/account-tab";
import { ApiTab } from "./settings/api-tab";
import { AccountsTab, AiTab, GeneralTab, JournalTab, RulesTab } from "./settings/settings-sections";
import { ShortcutsTab } from "./settings/shortcuts-tab";
import { SettingsNav, SettingsPageHeader, SettingsShell } from "./settings/settings-ui";
import { Page } from "@/components/Page";

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
  onUpdateAccount: (id: string, body: { name: string; broker: string }) => Promise<void>;
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
  onUpdateCash: (
    id: string,
    body: {
      type: string;
      amount: number;
      currency: string;
      occurred_at: string;
      note?: string;
    },
  ) => Promise<void>;
  onDeleteCash: (id: string) => Promise<void>;

  tags: TagType[];
  tagsLoading: boolean;
  tagsError: boolean;
  onCreateTag: (body: { name: string; color?: string; kind?: string }) => Promise<void>;
  onUpdateTag: (
    id: string,
    body: { name: string; color: string; description: string; kind: string },
  ) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;

  riskRules?: RiskRules;
  riskRulesLoading: boolean;
  riskRulesError: boolean;
  riskRulesSaving: boolean;
  onSaveRiskRules: (body: RiskRules) => Promise<void>;

  annualGoal?: AnnualGoal;
  annualGoalLoading: boolean;
  annualGoalError: boolean;
  annualGoalSaving: boolean;
  onSaveAnnualGoal: (body: { year: number; amount: number }) => Promise<void>;
  onClearAnnualGoal: (year: number) => Promise<void>;

  checklistItems: string[];
  checklistContent: string;
  checklistLoading: boolean;
  checklistError: boolean;
  checklistSaving: boolean;
  onSaveChecklist: (body: { items?: string[]; content: string }) => Promise<void>;
}

const NAV_ICONS: Record<SettingsSectionId, typeof Wallet> = {
  profile: UserRound,
  accounts: Wallet,
  rules: Shield,
  journal: Tag,
  ai: Sparkles,
  general: Globe,
  shortcuts: Keyboard,
  api: KeyRound,
  about: Github,
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
            onUpdateAccount={props.onUpdateAccount}
            onClearAccountTrades={props.onClearAccountTrades}
            cashTransactions={props.cashTransactions}
            cashLoading={props.cashLoading}
            cashError={props.cashError}
            onCreateCash={props.onCreateCash}
            onUpdateCash={props.onUpdateCash}
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
            annualGoal={props.annualGoal}
            annualGoalLoading={props.annualGoalLoading}
            annualGoalError={props.annualGoalError}
            annualGoalSaving={props.annualGoalSaving}
            onSaveAnnualGoal={props.onSaveAnnualGoal}
            onClearAnnualGoal={props.onClearAnnualGoal}
            checklistItems={props.checklistItems}
            checklistContent={props.checklistContent}
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
            onUpdateTag={props.onUpdateTag}
            onDeleteTag={props.onDeleteTag}
          />
        )}
        {section === "ai" && <AiTab />}
        {section === "profile" && <AccountTab />}
        {section === "general" && <GeneralTab />}
        {section === "shortcuts" && <ShortcutsTab />}
        {section === "api" && <ApiTab />}
        {section === "about" && <AboutTab />}
      </Page>
    </SettingsShell>
  );
}
