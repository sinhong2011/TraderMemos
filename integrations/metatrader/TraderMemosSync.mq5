//+------------------------------------------------------------------+
//| TraderMemosSync.mq5                                              |
//| Pushes this terminal's MT5 deals to a self-hosted TraderMemos    |
//| server. Runs inside the terminal: no broker password leaves the  |
//| machine, nothing to export by hand. Docs: docs/metatrader-ea.md  |
//+------------------------------------------------------------------+
#property copyright   "TraderMemos"
#property link        "https://github.com/sinhong2011/TraderMemos"
#property version     "1.00"
#property description "Syncs this account's buy/sell deals to TraderMemos."
#property description "Add the server URL under Tools > Options > Expert Advisors > Allow WebRequest."

input string InpServerUrl      = "https://your-tradermemos.example.com"; // TraderMemos URL
input string InpToken          = "";              // Personal access token (tm_pat_...)
input string InpAccountId      = "";              // TraderMemos account ID (Settings > Accounts)
input string InpSourceTimezone = "Europe/Athens"; // Broker server timezone (IANA name)
input int    InpBackfillDays   = 90;              // History sent on the first run
input int    InpSyncMinutes    = 5;               // Safety resync interval

#define TM_CHUNK        500     // deals per request (server caps at 5000)
#define TM_OVERLAP      86400   // resend the last day each sync; the server dedups
#define TM_TICK_SECONDS 5       // how soon a new deal is pushed
#define TM_RETRY_SECONDS 60     // backoff after a failed sync

string   g_watermarkKey;        // terminal global variable: last synced deal time
bool     g_pending  = true;     // a sync is owed (start-up, new deal, failed attempt)
datetime g_lastSync = 0;
datetime g_retryAt  = 0;        // no attempt before this after a failure

//+------------------------------------------------------------------+
int OnInit()
  {
   if(MQLInfoInteger(MQL_TESTER))
     {
      Print("TraderMemos: WebRequest is unavailable in the strategy tester");
      return(INIT_FAILED);
     }
   if(StringLen(InpToken) == 0 || StringLen(InpAccountId) == 0)
     {
      Print("TraderMemos: set Token and AccountId in the EA inputs");
      return(INIT_PARAMETERS_INCORRECT);
     }
   g_watermarkKey = "TM_SYNC_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "_" + InpAccountId;
   g_pending = true;
   EventSetTimer(TM_TICK_SECONDS);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
//| Network calls stay on the timer, never inside the trade event.   |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
      g_pending = true;
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   datetime now = TimeLocal();
   bool due = (now - g_lastSync) >= InpSyncMinutes * 60;
   if((!g_pending && !due) || now < g_retryAt)
      return;
   g_lastSync = now;
   g_pending = !SyncDeals();
   g_retryAt = g_pending ? now + TM_RETRY_SECONDS : 0;   // failures retry a minute later
  }

//+------------------------------------------------------------------+
//| Sends every buy/sell deal since the watermark (minus overlap).   |
//+------------------------------------------------------------------+
bool SyncDeals()
  {
   datetime now = TimeTradeServer();
   datetime from;
   if(GlobalVariableCheck(g_watermarkKey))
      from = (datetime)GlobalVariableGet(g_watermarkKey) - TM_OVERLAP;
   else
      from = now - (datetime)InpBackfillDays * 86400;

   if(!HistorySelect(from, now + 86400))
     {
      Print("TraderMemos: HistorySelect failed, error ", GetLastError());
      return(false);
     }

   string   deals[];
   datetime times[];
   datetime newest = 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0)
         continue;
      long type = HistoryDealGetInteger(ticket, DEAL_TYPE);
      if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL)
         continue;   // balance, credit, commission rows are not fills
      datetime t = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      if(t > newest)
         newest = t;
      int n = ArraySize(deals);
      ArrayResize(deals, n + 1, 1000);
      ArrayResize(times, n + 1, 1000);
      deals[n] = DealJson(ticket, type, t);
      times[n] = t;
     }

   int count = ArraySize(deals);
   for(int start = 0; start < count; start += TM_CHUNK)
     {
      int end = MathMin(start + TM_CHUNK, count);
      // Identical split fills are told apart by their order within one
      // request, so a chunk never ends inside a run of same-second deals.
      while(end < count && times[end] == times[end - 1])
         end++;
      if(!PostDeals(deals, start, end))
         return(false);   // watermark stays put; the next attempt resends
     }
   if(newest > 0)
      GlobalVariableSet(g_watermarkKey, (double)newest);
   return(true);
  }

//+------------------------------------------------------------------+
//| One deal in the shape POST /api/v1/sync/mt5 expects. Time is the |
//| broker server wall clock, exactly as the statement report shows. |
//+------------------------------------------------------------------+
string DealJson(const ulong ticket, const long type, const datetime t)
  {
   return(StringFormat(
             "{\"deal\":\"%s\",\"time\":\"%s\",\"type\":\"%s\",\"symbol\":\"%s\","
             "\"volume\":%s,\"price\":%s,\"commission\":%s,\"swap\":%s,\"fee\":%s}",
             IntegerToString((long)ticket),
             TimeToString(t, TIME_DATE | TIME_SECONDS),
             type == DEAL_TYPE_BUY ? "buy" : "sell",
             JsonEscape(HistoryDealGetString(ticket, DEAL_SYMBOL)),
             DoubleToString(HistoryDealGetDouble(ticket, DEAL_VOLUME), 8),
             DoubleToString(HistoryDealGetDouble(ticket, DEAL_PRICE), 8),
             DoubleToString(HistoryDealGetDouble(ticket, DEAL_COMMISSION), 8),
             DoubleToString(HistoryDealGetDouble(ticket, DEAL_SWAP), 8),
             DoubleToString(HistoryDealGetDouble(ticket, DEAL_FEE), 8)));
  }

//+------------------------------------------------------------------+
bool PostDeals(const string &deals[], const int start, const int end)
  {
   string list = "";
   for(int i = start; i < end; i++)
      list += (i > start ? "," : "") + deals[i];

   // Broker clock offset right now, rounded to 15 minutes — the server only
   // uses it to warn when InpSourceTimezone disagrees with the broker.
   int offset = (int)MathRound((double)(TimeTradeServer() - TimeGMT()) / 900.0) * 900;

   string body = StringFormat(
                    "{\"account_id\":\"%s\",\"source_tz\":\"%s\",\"server_utc_offset\":%d,"
                    "\"login\":\"%s\",\"server\":\"%s\",\"deals\":[%s]}",
                    JsonEscape(InpAccountId), JsonEscape(InpSourceTimezone), offset,
                    IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)),
                    JsonEscape(AccountInfoString(ACCOUNT_SERVER)), list);

   string url = InpServerUrl;
   while(StringLen(url) > 0 && StringGetCharacter(url, StringLen(url) - 1) == '/')
      url = StringSubstr(url, 0, StringLen(url) - 1);
   url += "/api/v1/sync/mt5";

   char post[], reply[];
   StringToCharArray(body, post, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(post, ArraySize(post) - 1);   // drop the trailing NUL
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + InpToken + "\r\n";
   string replyHeaders;

   ResetLastError();
   int status = WebRequest("POST", url, headers, 30000, post, reply, replyHeaders);
   if(status == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         Print("TraderMemos: add ", InpServerUrl, " under Tools > Options > Expert Advisors > Allow WebRequest for listed URL");
      else
         Print("TraderMemos: request failed, error ", err);
      return(false);
     }
   string text = CharArrayToString(reply, 0, WHOLE_ARRAY, CP_UTF8);
   if(status != 200)
     {
      Print("TraderMemos: server answered ", status, ": ", text);
      return(false);
     }

   long inserted = JsonInt(text, "inserted");
   if(inserted > 0)
      PrintFormat("TraderMemos: synced %d new deal(s), %d already there",
                  (int)inserted, (int)JsonInt(text, "skipped"));
   PrintList(text, "warnings");
   PrintList(text, "errors");
   return(true);
  }

//+------------------------------------------------------------------+
string JsonEscape(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return(s);
  }

//+------------------------------------------------------------------+
//| Reads a non-negative integer field from the server's compact     |
//| JSON reply; -1 when absent.                                      |
//+------------------------------------------------------------------+
long JsonInt(const string json, const string key)
  {
   string needle = "\"" + key + "\":";
   int p = StringFind(json, needle);
   if(p < 0)
      return(-1);
   p += StringLen(needle);
   int e = p;
   int len = StringLen(json);
   while(e < len)
     {
      ushort ch = StringGetCharacter(json, e);
      if(ch < '0' || ch > '9')
         break;
      e++;
     }
   return(StringToInteger(StringSubstr(json, p, e - p)));
  }

//+------------------------------------------------------------------+
//| Prints a non-empty array field (warnings / row errors) verbatim. |
//+------------------------------------------------------------------+
void PrintList(const string json, const string key)
  {
   string needle = "\"" + key + "\":[";
   int p = StringFind(json, needle);
   if(p < 0)
      return;
   p += StringLen(needle);
   int e = StringFind(json, "]", p);
   if(e > p)
      Print("TraderMemos ", key, ": ", StringSubstr(json, p, e - p));
  }
//+------------------------------------------------------------------+
