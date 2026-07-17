# MindBridge — Tech Stack

## Mục tiêu

Xây dựng MVP cho EduOne với hai workflow AI:

1. Cá nhân hóa lộ trình học và bài tập cho từng học viên.
2. Hỗ trợ đội content tạo bản nháp bài học, bài tập và quiz.

Phạm vi pilot hướng tới một khóa học, một lớp và khoảng 20 học viên.

## Stack chính

| Thành phần               | Công nghệ                   | Vai trò                                                    |
| ------------------------ | --------------------------- | ---------------------------------------------------------- |
| Full-stack framework     | TanStack Start + TypeScript | UI, routing và server functions                            |
| Styling/UI               | Tailwind CSS + shadcn/ui    | Xây dựng giao diện prototype nhanh, nhất quán              |
| Authentication           | Better Auth                 | Đăng nhập, session và quản lý user                         |
| Database                 | PostgreSQL                  | Lưu user profile, tiến độ học, lịch sử đề xuất và nội dung |
| AI workflow              | BAML                        | Định nghĩa prompt và structured output có kiểu dữ liệu     |
| Internal content agent   | pi.dev SDK                  | Agent hỗ trợ đội content trong quy trình soạn thảo         |
| Unit/integration testing | Vitest                      | Kiểm thử logic ứng dụng và server functions                |
| AI evaluation            | BAML tests/evals            | Kiểm thử prompt và chất lượng đầu ra AI                    |

## Kiến trúc vai trò

```text
TanStack Start
├── Better Auth
├── PostgreSQL
├── BAML
│   ├── RecommendLearningPath
│   └── GenerateLessonDraft
├── pi.dev SDK
│   └── Internal content agent
└── Vitest + BAML evals
```

## Quyết định kỹ thuật

### TanStack Start

Dùng TanStack Start làm lớp full-stack duy nhất cho MVP. Các thao tác cần secret hoặc truy cập database phải chạy qua server functions/server routes, không gọi trực tiếp từ client.

### Better Auth + PostgreSQL

Better Auth chịu trách nhiệm authentication và session. PostgreSQL là database chính, bao gồm cả dữ liệu cần cho Better Auth và dữ liệu nghiệp vụ.

Không dùng Supabase Auth để tránh có hai hệ thống authentication. Cũng không bắt buộc dùng Supabase SDK; PostgreSQL có thể được host và quản lý độc lập.

### BAML

BAML là lớp AI core, không để prompt và parsing rải rác trong UI. Tối thiểu cần hai function có output có cấu trúc:

- `RecommendLearningPath`: nhận profile/trạng thái học tập và trả về lý do, mục tiêu, bài học hoặc bài tập đề xuất.
- `GenerateLessonDraft`: nhận chủ đề, trình độ và mục tiêu học tập, trả về bản nháp bài học/bài tập/quiz.

Mỗi đề xuất cần giữ lại lý do để kiến trúc AI có thể giải thích trong demo. Nội dung do AI tạo phải đi qua bước human review trước khi hiển thị cho học viên.

### pi.dev SDK

Dùng pi.dev SDK cho agent nội bộ của đội content: hỗ trợ tìm ngữ cảnh, tạo/chỉnh sửa bản nháp và thực hiện các bước có công cụ.

Không dùng agent làm nguồn quyết định trực tiếp cho lộ trình học viên. Recommendation nên chạy qua BAML workflow có schema và log rõ ràng để dễ kiểm soát, kiểm thử và giải thích.

## Dữ liệu tối thiểu

- `users` và bảng session do Better Auth yêu cầu.
- Hồ sơ học viên: lớp, trình độ, mục tiêu và ngôn ngữ.
- Tiến độ: bài đã học, kết quả, thời gian và các lỗi thường gặp.
- Recommendation log: đầu vào, đề xuất, lý do và timestamp.
- Content draft: loại nội dung, bản nháp AI, trạng thái review và phiên bản đã duyệt.

## Kiểm thử và đánh giá

- **Vitest:** kiểm tra authorization, server functions, scoring tiến độ, chọn bài và các trường hợp biên.
- **BAML tests/evals:** kiểm tra output đúng schema, recommendation có lý do, nội dung đúng ngôn ngữ/trình độ và không bỏ qua human review.
- **Scenario set:** chuẩn bị 10–20 hồ sơ học viên đại diện cho các mức trình độ và tốc độ học khác nhau.
- **Demo metrics:** tỷ lệ output hợp lệ, độ phù hợp của recommendation qua rubric, thời gian tạo bản nháp trước/sau và tỷ lệ nội dung cần chỉnh sửa.

## Không nằm trong MVP

- Supabase Auth.
- Agent tự động xuất bản nội dung không qua người duyệt.
- Recommendation hoàn toàn dựa trên hội thoại tự do, không có schema hoặc log.
- Hệ thống analytics và adaptive learning quy mô lớn ngoài pilot 20 học viên.
