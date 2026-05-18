$file = "$env:USERPROFILE\AppData\Local\Pub\Cache\hosted\pub.dev\flutter_secure_storage_windows-3.1.2\windows\flutter_secure_storage_windows_plugin.cpp"
$content = Get-Content $file -Raw
if ($content -match "atlstr\.h") {
  $content = $content -replace '#include <atlstr\.h>', @'
#include <string>
#include <vector>

class CA2W {
public:
    LPWSTR m_psz;
private:
    std::vector<wchar_t> m_buf;
public:
    CA2W(const char* psz) : m_psz(nullptr) {
        if (!psz) return;
        int len = MultiByteToWideChar(CP_ACP, 0, psz, -1, nullptr, 0);
        if (len <= 0) return;
        m_buf.resize(len);
        MultiByteToWideChar(CP_ACP, 0, psz, -1, m_buf.data(), len);
        m_psz = m_buf.data();
    }
    operator LPCWSTR() const { return m_psz; }
};

class CW2A {
    std::string m_str;
public:
    CW2A(const wchar_t* pwsz) {
        if (!pwsz) return;
        int len = WideCharToMultiByte(CP_ACP, 0, pwsz, -1, nullptr, 0, nullptr, nullptr);
        if (len <= 0) return;
        m_str.resize(len - 1);
        WideCharToMultiByte(CP_ACP, 0, pwsz, -1, &m_str[0], len, nullptr, nullptr);
    }
    operator LPCSTR() const { return m_str.c_str(); }
};
'@
  Set-Content $file $content
  Write-Output "Patched: $file"
} else {
  Write-Output "Already patched or atlstr.h not found"
}
