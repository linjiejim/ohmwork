import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { GitHubMark } from "./GitHubMark"
import {
  closeAuthDialogs,
  loginWithPassword,
  registerWithPassword,
  setAuthTab,
  startGithubLogin,
  useAuth,
} from "./store"

const USERNAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,23}$/

export function AuthDialog() {
  const auth = useAuth()
  const open = auth.dialog === "auth"
  const tab = auth.authTab

  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setError(null)
      setPassword("")
      setConfirm("")
      setBusy(false)
    }
  }, [open])

  const switchTab = (next: "login" | "register") => {
    setAuthTab(next)
    setError(null)
    setConfirm("")
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const u = username.trim()
    if (!u) {
      setError("请输入用户名")
      return
    }
    if (tab === "register" && !USERNAME_RE.test(u)) {
      setError("用户名需为 3–24 位字母、数字、下划线或连字符，且以字母或数字开头")
      return
    }
    if (!password) {
      setError("请输入密码")
      return
    }
    if (tab === "register" && password.length < 8) {
      setError("密码至少需要 8 位")
      return
    }
    if (tab === "register" && password !== confirm) {
      setError("两次输入的密码不一致")
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (tab === "login") await loginWithPassword(u, password)
      else await registerWithPassword(u, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请稍后重试")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && closeAuthDialogs()}>
      <DialogContent size="sm">
        <DialogHeader
          title="同步学习进度"
          description="仅用于跨设备保存已学课程。不登录也能照常在本地学习。"
        />
        <DialogBody className="pb-5">
          {auth.githubEnabled && (
            <>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => startGithubLogin()}
              >
                <GitHubMark className="size-4 shrink-0" />
                使用 GitHub 登录
              </Button>
              <div className="my-4 flex items-center gap-3 text-caption text-faint-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>或使用用户名和密码</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <Segmented<"login" | "register">
            aria-label="登录或注册"
            value={tab}
            onValueChange={switchTab}
            className="mb-4 grid w-full grid-cols-2"
            options={[
              { value: "login", label: "登录" },
              { value: "register", label: "注册" },
            ]}
          />

          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field
                label="用户名"
                hint={tab === "register" ? "3–24 位字母、数字、下划线或连字符" : undefined}
              >
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="例如 alice_ee"
                />
              </Field>
              <Field label="密码" hint={tab === "register" ? "至少 8 位" : undefined}>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                />
              </Field>
              {tab === "register" && (
                <Field label="确认密码">
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
              )}
            </FieldGroup>

            {error && (
              <p role="alert" className="mt-3 text-small text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" loading={busy} className="mt-5 w-full">
              {tab === "login" ? "登录账号" : "创建账号"}
            </Button>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
