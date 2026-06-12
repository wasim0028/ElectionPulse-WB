using ElectionAPI.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// FIXED: Register core framework health check services infrastructure
builder.Services.AddHealthChecks();

builder.Services.AddDbContext<ElectionDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

// ── CORS — allow Vite dev server on :5173 ────────────────────────────────────
builder.Services.AddCors(opts =>
    opts.AddPolicy("AllowAll", policy =>
        policy
            .AllowAnyOrigin()   // allows localhost:5173 and any other origin
            .AllowAnyHeader()
            .AllowAnyMethod()));

// ── Pipeline ──────────────────────────────────────────────────────────────────
var app = builder.Build();

// Swagger in all environments (handy for debugging)
app.UseSwagger();
app.UseSwaggerUI();

// CORS must come BEFORE routing and controllers
app.UseCors("AllowAll");

app.UseAuthorization();

// FIXED: Expose the route requested by your Dockerfile healthcheck command
app.MapHealthChecks("/health");

app.MapControllers();
app.Run();

