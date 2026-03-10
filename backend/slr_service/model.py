import torch
import torch.nn as nn
import torch.nn.functional as F


class ISLModel(nn.Module):
    """BiLSTM with Attention for ISL recognition"""

    def __init__(self, input_dim=258, hidden_dim=128, num_classes=926, dropout=0.5):
        super().__init__()

        self.lstm = nn.LSTM(
            input_dim, hidden_dim, num_layers=2,
            batch_first=True, bidirectional=True, dropout=dropout
        )
        self.lstm_drop = nn.Dropout(0.3)

        # Attention mechanism
        self.attention = nn.Sequential(
            nn.Linear(hidden_dim * 2, 128),
            nn.Tanh(),
            nn.Linear(128, 1)
        )

        # Classifier
        self.classifier = nn.Sequential(
            nn.Dropout(dropout),
            nn.Linear(hidden_dim * 2, 512),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(512, num_classes)
        )

    def forward(self, x):
        # x: [batch, seq_len, input_dim]
        lstm_out, _ = self.lstm(x)           # [batch, seq_len, hidden*2]
        lstm_out = self.lstm_drop(lstm_out)

        # Attention weights
        attn_weights = F.softmax(self.attention(lstm_out), dim=1)  # [batch, seq_len, 1]

        # Context vector
        context = torch.sum(attn_weights * lstm_out, dim=1)        # [batch, hidden*2]

        return self.classifier(context)
