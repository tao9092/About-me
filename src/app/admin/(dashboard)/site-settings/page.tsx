import { createClient } from "@/lib/supabase/server";
import {
  updateProfileAction,
  updateSettingsAction,
} from "@/app/actions/admin-meta";
export default async function Page() {
  const supabase = await createClient();
  const [
    { data: profile, error: profileError },
    { data: settings, error: settingsError },
  ] = await Promise.all([
    supabase.from("site_profile").select("*").eq("singleton", true).single(),
    supabase.from("site_settings").select("*").eq("singleton", true).single(),
  ]);
  if (profileError) throw new Error(profileError.message);
  if (settingsError) throw new Error(settingsError.message);
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Site Settings</h1>
          <p>
            Edit public identity and site-level defaults without touching code.
          </p>
        </div>
      </header>
      <form action={updateProfileAction} className="form-panel settings-form">
        <div>
          <h2>Public profile</h2>
          <p>Used by the home Hero and metadata.</p>
        </div>
        <div className="form-fields two-col">
          <label>
            Name (English) <em aria-label="required">*</em>
            <input name="name_en" required defaultValue={profile.name_en} />
          </label>
          <label>
            姓名（中文）
            <input name="name_zh" defaultValue={profile.name_zh ?? ""} />
          </label>
          <label>
            Headline (English) <em aria-label="required">*</em>
            <input
              name="headline_en"
              required
              defaultValue={profile.headline_en}
            />
          </label>
          <label>
            职业标题（中文）
            <input
              name="headline_zh"
              defaultValue={profile.headline_zh ?? ""}
            />
          </label>
          <label className="full-field">
            Bio (English)
            <textarea
              name="bio_en"
              rows={5}
              defaultValue={profile.bio_en ?? ""}
            />
          </label>
          <label className="full-field">
            简介（中文）
            <textarea
              name="bio_zh"
              rows={5}
              defaultValue={profile.bio_zh ?? ""}
            />
          </label>
          <button className="button">Save profile</button>
        </div>
      </form>
      <form action={updateSettingsAction} className="form-panel settings-form">
        <div>
          <h2>Site defaults</h2>
          <p>General name, language and protected-access hint.</p>
        </div>
        <div className="form-fields">
          <label>
            Site title <em aria-label="required">*</em>
            <input
              name="site_title"
              required
              defaultValue={settings.site_title}
            />
          </label>
          <label>
            Default language <em aria-label="required">*</em>
            <select
              name="default_locale"
              defaultValue={settings.default_locale}
            >
              <option value="en">English</option>
              <option value="zh">简体中文</option>
            </select>
          </label>
          <label>
            Protected password hint
            <input
              name="protected_password_hint"
              defaultValue={settings.protected_password_hint ?? ""}
            />
          </label>
          <button className="button">Save settings</button>
        </div>
      </form>
    </>
  );
}
