import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ChatMessage from '@/components/ChatMessage';
import ConfirmCard from '@/components/ConfirmCard';
import { type ConfirmRow } from '@/components/ConfirmSheet';
import { mono, useZapprTheme } from '@/lib/theme';
import { callAgent } from '@/lib/agent/api';
import { executeTool } from '@/lib/agent/executor';
import { CONFIRM_TOOLS } from '@/lib/agent/tools';
import { useAgentStore } from '@/store/useAgentStore';
import type { AgentContentBlock, AgentMessage as Msg, PendingConfirmation } from '@/types/agent';

type ToolUseBlock = Extract<AgentContentBlock, { type: 'tool_use' }>;

const CHIPS = [
  'Check my balance',
  "What's happening in my feed?",
  'Cash out 5,000 sats',
  'Abeg summarize the top posts',
];

const WELCOME: Msg = {
  role: 'assistant',
  content: [
    {
      type: 'text',
      text: "Ẹ n lẹ 👋 I'm your zappr agent. Ask me to check balance, zap, send, or cash out — in English, Pidgin, Yorùbá, Hausa and more.",
    },
  ],
};

export default function AgentScreen() {
  const t = useZapprTheme();
  const {
    messages, addMessage, setMessages, busy, setBusy, status, setStatus, pending, setPending,
  } = useAgentStore();
  const [draft, setDraft] = useState('');
  const [confirmBusy, setConfirmBusy] = useState(false);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length, status, pending]);

  /*
    Same agent loop as web AgentChat: call /api/agent until stop_reason
    isn't tool_use; pause the loop for confirmation-required tools (money
    or public posts) and resume with the tool result after Approve/Cancel.
  */
  const runLoop = async (initial: Msg[]) => {
    setBusy(true);
    setStatus('Thinking…');
    let convo: Msg[] = initial;
    try {
      for (;;) {
        const resp = await callAgent(convo);
        const assistantMsg: Msg = { role: 'assistant', content: resp.content };
        convo = [...convo, assistantMsg];
        setMessages(convo);

        if (resp.stop_reason !== 'tool_use') break;

        const toolUses = (resp.content || []).filter(
          (b): b is ToolUseBlock => b.type === 'tool_use'
        );

        const needsConfirm = toolUses.find((tu) => CONFIRM_TOOLS.has(tu.name));
        if (needsConfirm) {
          setPending({
            id: Crypto.randomUUID(),
            tool: needsConfirm.name as PendingConfirmation['tool'],
            input: needsConfirm.input,
            toolUseId: needsConfirm.id,
          });
          setStatus(null);
          setBusy(false);
          return; // paused — the inline ConfirmCard resumes the loop
        }

        const results: AgentContentBlock[] = [];
        for (const tu of toolUses) {
          setStatus(`⚡ ${tu.name.replace(/_/g, ' ')}…`);
          try {
            const out = await executeTool(tu.name, tu.input);
            results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
          } catch (e) {
            results.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' }),
            });
          }
        }
        convo = [...convo, { role: 'user', content: results }];
        setMessages(convo);
      }
    } catch (e) {
      addMessage({
        role: 'assistant',
        content: [{ type: 'text', text: `⚠ ${e instanceof Error ? e.message : 'Agent error'}` }],
      });
    } finally {
      setStatus(null);
      setBusy(false);
    }
  };

  const handleSend = (text: string) => {
    if (!text.trim() || busy) return;
    setDraft('');
    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    runLoop(next);
  };

  const handleConfirm = async (approve: boolean) => {
    if (!pending) return;
    const { toolUseId, tool, input } = pending;
    let resultContent: string;
    if (approve) {
      setConfirmBusy(true);
      try {
        const out = await executeTool(tool, input);
        resultContent = JSON.stringify(out);
      } catch (e) {
        resultContent = JSON.stringify({ error: e instanceof Error ? e.message : 'Tool failed' });
      }
      setConfirmBusy(false);
    } else {
      resultContent = JSON.stringify({ error: 'User cancelled' });
    }
    setPending(null);
    const next: Msg[] = [
      ...messages,
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseId, content: resultContent }] },
    ];
    setMessages(next);
    runLoop(next);
  };

  const data = messages.length === 0 ? [WELCOME] : messages;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* Header bar (mockup): orange Z badge + title + live dot */}
        <View
          style={{
            paddingHorizontal: 18,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottomWidth: 1,
            borderBottomColor: t.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                backgroundColor: t.orange,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={[mono, { color: t.onOrange, fontWeight: '700', fontSize: 13 }]}>Z</Text>
            </View>
            <Text style={{ color: t.bone, fontWeight: '700', fontSize: 16 }}>zappr agent</Text>
          </View>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.live }} />
        </View>

        <FlatList
          ref={listRef}
          data={data}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <ChatMessage message={item} />}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 16, gap: 11, flexGrow: 1 }}
          ListFooterComponent={
            <View style={{ gap: 11 }}>
              {pending ? (
                <ConfirmCard
                  title={confirmTitle(pending)}
                  rows={confirmRows(pending)}
                  busy={confirmBusy}
                  onApprove={() => handleConfirm(true)}
                  onCancel={() => handleConfirm(false)}
                />
              ) : null}
              {status ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    alignSelf: 'flex-start',
                    backgroundColor: t.surface,
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <ActivityIndicator size="small" color={t.orange} />
                  <Text style={[mono, { color: t.orange, fontSize: 11 }]}>{status}</Text>
                </View>
              ) : null}
            </View>
          }
        />

        {/* Chips + input (mockup): suggestion pills always visible above the composer */}
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 14,
            borderTopWidth: 1,
            borderTopColor: t.line,
            backgroundColor: t.bg,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginBottom: 9 }}
            contentContainerStyle={{ gap: 7 }}
          >
            {CHIPS.map((c) => (
              <Pressable
                key={c}
                onPress={() => handleSend(c)}
                disabled={busy}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: t.line,
                  backgroundColor: t.surface,
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <Text style={{ color: t.dim, fontSize: 12, fontWeight: '500' }}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the agent…"
              placeholderTextColor={t.faint}
              editable={!busy}
              onSubmitEditing={() => handleSend(draft)}
              returnKeyType="send"
              style={{
                flex: 1,
                minWidth: 0,
                backgroundColor: t.surface,
                color: t.bone,
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 14.5,
              }}
            />
            <Pressable
              onPress={() => handleSend(draft)}
              disabled={busy || !draft.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: t.orange,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy || !draft.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: t.onOrange, fontSize: 17, fontWeight: '700' }}>↑</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function confirmTitle(p: PendingConfirmation): string {
  const i = p.input;
  switch (p.tool) {
    case 'zap_note':
      return `Zap ${Number(i.amount_sats || 0).toLocaleString()} sats`;
    case 'send_payment':
      return `Send ${Number(i.amount_sats || 0).toLocaleString()} sats`;
    case 'execute_offramp_ngn':
      return 'Cash out to NGN';
    case 'post_note':
      return 'Post to Nostr';
    default:
      return 'Confirm action';
  }
}

function confirmRows(p: PendingConfirmation): ConfirmRow[] {
  const i = p.input;
  if (p.tool === 'execute_offramp_ngn') {
    return [
      { label: 'You send', value: `${Number(i.sats_to_send || 0).toLocaleString()} sats`, accent: true },
      { label: 'They receive', value: `₦${Number(i.ngn_to_receive || 0).toLocaleString()}`, accent: true },
      { label: 'Bank', value: String(i.bank_name || '—') },
      { label: 'Account', value: String(i.account_number || '—') },
      ...(i.account_name ? [{ label: 'Name', value: String(i.account_name) }] : []),
    ];
  }
  if (p.tool === 'send_payment') {
    return [
      { label: 'To', value: String(i.recipient || '—').slice(0, 40) },
      { label: 'Amount', value: `${Number(i.amount_sats || 0).toLocaleString()} sats`, accent: true },
      ...(i.memo ? [{ label: 'Memo', value: String(i.memo) }] : []),
    ];
  }
  if (p.tool === 'zap_note') {
    return [
      { label: 'To', value: String(i.target_npub || '—').slice(0, 24) + '…' },
      { label: 'Amount', value: `${Number(i.amount_sats || 0).toLocaleString()} sats`, accent: true },
    ];
  }
  if (p.tool === 'post_note') {
    return [{ label: 'Post', value: String(i.content || '').slice(0, 120) }];
  }
  return Object.entries(i).map(([k, v]) => ({ label: k, value: String(v).slice(0, 60) }));
}
